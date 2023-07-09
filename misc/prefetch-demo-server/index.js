const PORT = 8081;
const MESSAGES = [
	"Hello World!",
	"Hello",
	"Hi"
];

import express from "express";

const app = express();

app.get("/", async (req, res) => {
	await new Promise(resolve => setTimeout(resolve, 100));

	res.setHeader("Access-Control-Allow-Origin", "*");
	res.send(
		MESSAGES[[Math.floor(Math.random() * MESSAGES.length)]]
	);
});

app.listen(PORT, () => {
	console.log(`Running on port ${PORT}.`);
});