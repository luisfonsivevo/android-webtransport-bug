import { Http3Server } from "@fails-components/webtransport";
import { readFileSync } from "fs";
import { createHash, X509Certificate } from "crypto";

//insane requirements to connect:
//- certificate must have < 14 day shelf life
//- certificate must be ECDSA encrypted
//- must connect to the server via an ipv4 address, not localhost
//https://stackoverflow.com/a/76125650
/*
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
-nodes -keyout key.pem -out cert.pem -days 13 \
-subj "/CN=127.0.0.1" \
-addext "subjectAltName=IP:127.0.0.1"
*/

const CERT = "cert.pem";
const PRIVKEY = "key.pem";
const PORT = 8642;

const certHash = Array.from(
	createHash("sha256")
		.update(new X509Certificate(readFileSync(CERT)).raw)
		.digest()
).join(", ");
console.log(
	`new WebTransport("https://192.168.x.x:${PORT}", { serverCertificateHashes: [{ algorithm: "sha-256", value: new Uint8Array([${certHash}]) }] });`
);

Bun.serve({
	port: 8080,
	tls: {
		cert: readFileSync(CERT),
		key: readFileSync(PRIVKEY),
	},
	fetch() {
		return new Response(Bun.file("src/client.html"));
	},
});

const server = new Http3Server({
	port: PORT,
	host: "0.0.0.0",
	secret: "secret",
	cert: readFileSync(CERT),
	privKey: readFileSync(PRIVKEY),
});

server.startServer();
await server.ready;

const reader = (
	await (
		await server.sessionStream("/").getReader().read()
	).value.incomingUnidirectionalStreams
		.getReader()
		.read()
).value.getReader();

console.log("client connected");

while (true) {
	const value = (await reader.read()).value;
	console.log(`received ${value.byteLength} bytes`);
}
