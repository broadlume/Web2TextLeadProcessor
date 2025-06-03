export * as FfWebAPI from "./FfWebAPI";
export const FF_HEADERS = () => {
    const headers = new Headers({
        "Content-Type": "application/x-www-form-urlencoded",
    });
    return headers;
};
