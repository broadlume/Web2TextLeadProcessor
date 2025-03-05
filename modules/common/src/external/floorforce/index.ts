export * as FfWebAPI from "./FfWebAPI";
export const FF_AUTHORIZATION_HEADERS = () => {
	const headers = new Headers();
	headers.set(
		"Authorization",
		`Basic ${Buffer.from(
			`${process.env.FF_API_USERNAME}:${process.env.FF_API_PASSWORD}`,
			"binary",
		).toString("base64")}`,
	);
	headers.set("Content-Type", "application/x-www-form-urlencoded");
	return headers;
};
