export type ApiError = {
    error?: string;
}

export type ApiSimpleResponse<T> = {
    data?: T;
    message?: string;
}

export type ApiRecordResponse<T> = {
    id: string;
    data: T;
    createdAt: string;
    updatedAt: string;
}

export type ApiRecordsResponse<T> = {
    records: ApiRecordResponse<T>[];
    count?: number;
    page?: number;
    pages?: number;
}