import { ApiRecordResponse } from "./types";

export type CollectionFields = { [key: string]: ConfigFieldTypes };

export type CollectionAccess = {
    create?: string[];
    read?: string[];
    update?: string[];
    delete?: string[];
}

export type CollectionConfig<T extends CollectionFields> = {
    label: CollectionConfigFieldLabel;
    fields: T;
    // auth?: boolean;
    // external?: boolean;
    access?: CollectionAccess;
    hooks?: {
        beforeCreate?: (data: FieldValues<T>) => Promise<FieldValues<T>>;
        afterCreate?: (data: CollectionRecord<T>) => Promise<void>;
        // beforeRead?: () => Promise<void>;
        // afterRead?: (data: FieldValues<T>) => Promise<FieldValues<T>>;
        beforeUpdate?: (old: CollectionRecord<T>, updated: FieldValues<T>) => Promise<FieldValues<T>>;
        afterUpdate?: (old: CollectionRecord<T>, updated: CollectionRecord<T>) => Promise<void>;
        beforeDelete?: (data: CollectionRecord<T>) => Promise<void>;
        afterDelete?: (data: CollectionRecord<T>) => Promise<void>;
    }
}

export function collection<T extends CollectionFields>(config: CollectionConfig<T>): CollectionConfig<T> {
    return config;
}

type CollectionRecord<T extends CollectionFields> = ApiRecordResponse<FieldValues<T>>

// export type FieldValues<T extends CollectionFields> = {
//     [K in keyof T]: T[K]["default"];
// }

export type FieldValues<T extends CollectionFields, K extends keyof T = keyof T> =
    {
        [P in K as T[P] extends { required: true } ? never : P]?: T[P]["default"] | null;
    } & {
        [P in K as T[P] extends { required: false } ? never : P]: T[P]["default"];
    };


export type ConfigFieldTypes = ConfigFieldText |
    ConfigFieldNumber |
    ConfigFieldDate |
    ConfigFieldDateTime |
    ConfigFieldList |
    ConfigFieldUpload;


export type CollectionConfigFieldLabel = string | {
    singular: string;
    plural: string;
} | {
    singular: Record<string, string>;
    plural: Record<string, string>;
};

export type ConfigFieldText = {
    label: CollectionConfigFieldLabel;
    type: 'text';
    required: boolean;
    default: string;
};

export type ConfigFieldNumber = {
    label: CollectionConfigFieldLabel;
    type: 'number';
    required: boolean;
    default: number;
}

export type ConfigFieldDate = {
    label: CollectionConfigFieldLabel;
    type: 'date';
    required: boolean;
    default: Date;
};

export type ConfigFieldDateTime = {
    label: CollectionConfigFieldLabel;
    type: 'datetime';
    required: boolean;
    default: Date;
};

export type ConfigFieldList = {
    label: CollectionConfigFieldLabel;
    type: 'list';
    required: boolean;
    fields: ConfigFieldTypes[];
    default: ConfigFieldTypes[];
};

export type ConfigFieldUpload = {
    label: CollectionConfigFieldLabel;
    type: 'upload';
    required: boolean;
    default: string;
};