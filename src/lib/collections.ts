export type CollectionFields = { [key: string]: ConfigFieldTypes };

export type CollectionConfig<T extends CollectionFields> = {
    label: CollectionConfigFieldLabel;
    fields: T;
    auth?: boolean;
    external?: boolean;
    access?: {
        create?: string[];
        read?: string[];
        update?: string[];
        delete?: string[];
    };
    hooks?: {
        beforeCreate?: (data: FieldValues<T>) => Promise<FieldValues<T>>;
        afterCreate?: (data: FieldValues<T>) => Promise<void>;
        beforeUpdate?: (old: FieldValues<T>, updated: FieldValues<T>) => Promise<FieldValues<T>>;
        afterUpdate?: (old: FieldValues<T>, updated: FieldValues<T>) => Promise<void>;
        beforeDelete?: (data: FieldValues<T>) => Promise<void>;
        afterDelete?: (data: FieldValues<T>) => Promise<void>;
    }
}

export function collection<T extends CollectionFields>(config: CollectionConfig<T>): CollectionConfig<T> {
    return config;
}

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