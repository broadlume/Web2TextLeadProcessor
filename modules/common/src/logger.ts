import ecsFormat from "@elastic/ecs-winston-format";
import { serializeError } from "serialize-error";
import winston from "winston";

const myFormat = winston.format.printf(
	({ level, message, label, timestamp, errors = [] }) => {
		const labels = [label]
			.flat()
			.filter((l) => l != null && l.trim() !== "")
			.map((l) => `[${l}]`)
			.join(" ");
		errors = errors.map(
			(e: Error) =>
				`${e.stack}\n${JSON.stringify({ ...serializeError(e), stack: undefined })}`,
		);
		return `${timestamp} ${labels} ${level}: ${message}${errors.length > 0 ? `${errors}` : ""}`;
	},
);
const devFormatter = winston.format.combine(
	winston.format.timestamp(),
	winston.format.splat(),
	winston.format.colorize(),
	myFormat,
);
const prodFormatter = ecsFormat();

export const logger = winston.createLogger({
	level: "info",
	format: process.env.NODE_ENV === "production" ? prodFormatter : devFormatter,
	defaultMeta: { name: "Web2Text Handler", hostname: "localhost" },
	transports: [new winston.transports.Console()],
});
