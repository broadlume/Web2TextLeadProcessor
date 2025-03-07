import ky from "ky";
import { logger } from "../../logger";

interface FindTableRowsRequest {
	limit?: number;
	offset?: number;
    filter?: any;
    group?: any;
    search?: string;
	orderBy?: string;
    orderDirection?: "asc" | "desc";
}
interface FindTableRowsResponse {
    rows: {
        id: number;
        createdAt: string;
        updateAt: string;
        computed: any;
        stale: string[];
        similarity?: number;
        [x: string]: any;
    }[];
    hasMore: boolean;
    offset: number;
    limit: number;
    warnings?: string[];
}

export async function FindTableRows(table: string, botId: string, workspaceId: string, query: FindTableRowsRequest): Promise<FindTableRowsResponse> {
    try {
        if (process.env.BOTPRESS_API_TOKEN == null) {
            throw new Error("BOTPRESS_API_TOKEN is not set");
        }
        const response = await ky.post(`https://api.botpress.cloud/v1/tables/${table}/rows/find`, {
            headers: {
                "x-bot-id": botId,
                "x-workspace-id": workspaceId,
                Authorization: `Bearer ${process.env.BOTPRESS_API_TOKEN!}`,
            },
            json: query,
        })
        return response.json();
    } catch (error) {
		logger
			.child({ label: "BotpressTableAPI:FindTableRows" })
			.warn(`Failed to fetch rows from Botpress on table '${table}'`, {
				_meta: 1,
				Table: table,
                BotId: botId,
                WorkspaceId: workspaceId,
                Query: query,
			});
		logger.child({ label: "BotpressTableAPI:FindTableRows" }).error(error);
		throw error;
    }

}