import util from "node:util";
import type * as restate from "@restatedev/restate-sdk";
import { serializeError } from "serialize-error";
import type winston from "winston";

/**
 * Create a Restate logger that uses a winston logger
 * Has support for labels, errors, and metadata
 * Log an object with a field `_meta:1` to include it in the metadata on ECS
 * @param logger - The winston logger to use
 * @returns A Restate logger
 */
export const CreateNewRestateLogger: (
	logger: winston.Logger,
) => restate.Logger =
	(logger) =>
		(params, message, ...o) => {
			if (params.replaying) {
				return;
			}
			const separated: { messages: string[]; errors: Error[]; meta: any } = [
				message,
				...o,
			].reduce(
				(acc, m) => {
					if (m instanceof Error) {
						acc.errors.push(m);
					} else {
						if (typeof m === "string") {
							acc.messages.push(m);
						} else {
							if (typeof m === "object" && m["_meta"] != null) {
								delete m["_meta"];
								acc.meta = m;
							} else {
								acc.messages.push(util.inspect(m, false, null, true));
							}
						}
					}
					return acc;
				},
				{ messages: [], errors: [], meta: {} },
			);

			logger.log(params.level, separated.messages.join(" "), {
				...params,
				...separated.meta,
				label: [
					"Restate",
					params.context?.invocationTarget,
					params.context?.invocationId,
					...[separated.meta.label].flat().filter((x) => x != null),
				],
				errors: separated.errors.map((e: Error) => serializeError(e)),
			});
		};
