import ecsFormat from "@elastic/ecs-winston-format";
import { serializeError } from "serialize-error";
import { assert, is } from "tsafe";
import winston from "winston";
import { GetRunningEnvironment } from "./util";

const myFormat = winston.format.printf(({ level, message, label, timestamp, errors = [] }) => {
    assert(is<string | string[]>(label));
    assert(is<Error[]>(errors));
    const labels = [label]
        .flat()
        .filter((l) => l != null && l.trim() !== "")
        .map((l) => `[${l}]`)
        .join(" ");
    const formattedErrors = errors.map(
        (e: Error) => `${e.stack}\n${JSON.stringify({ ...serializeError(e), stack: undefined })}`,
    );
    return `${timestamp} ${labels} ${level}: ${message}${formattedErrors.length > 0 ? `${formattedErrors}` : ""}`;
});
const devFormatter = winston.format.combine(
    winston.format.timestamp(),
    winston.format.splat(),
    winston.format.colorize(),
    myFormat,
);
const prodFormatter = ecsFormat();

export const logger = winston.createLogger({
    level: "info",
    format: GetRunningEnvironment().local ? devFormatter : prodFormatter,
    defaultMeta: { name: "Lead Processor Handler", hostname: "localhost" },
    transports: [new winston.transports.Console()],
});
