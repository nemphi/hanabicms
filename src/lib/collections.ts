export type CollectionConfig = {
    slug: string;
    name: string;
    fields: CollectionConfigFieldTypes[];
    auth?: boolean;
    access?: {
        create?: string[];
        read?: string[];
        update?: string[];
        delete?: string[];
    };
    hooks?: {
        beforeCreate?: (data: any) => any;
        afterCreate?: (data: any) => any;
        beforeUpdate?: (old: any, updated: any) => any;
        afterUpdate?: (old: any, updated: any) => any;
        beforeDelete?: (data: any) => any;
        afterDelete?: (data: any) => any;
    }
}

export type CollectionValues<T extends CollectionConfig> = { [key in T["fields"][number]["name"]]: CollectionFieldValue<T["fields"][number]> }

export type CollectionFieldValue<T extends CollectionConfigFieldTypes> = T["default"]

export type CollectionConfigFieldTypes = CollectionConfigFieldText |
    CollectionConfigFieldNumber |
    CollectionConfigFieldDate |
    CollectionConfigFieldDateTime |
    CollectionConfigFieldList |
    CollectionConfigFieldUpload;

export type CollectionConfigFieldLabel = string | {
    singular: string;
    plural: string;
} | {
    singular: { [key: string]: string };
    plural: { [key: string]: string };
};

export type CollectionConfigFieldText = {
    name: string;
    label: CollectionConfigFieldLabel;
    type: 'text';
    required?: boolean;
    default?: string;
}

export type CollectionConfigFieldNumber = {
    name: string;
    label: CollectionConfigFieldLabel;
    type: 'number';
    required?: boolean;
    default?: number;
}

export type CollectionConfigFieldDate = {
    name: string;
    label: CollectionConfigFieldLabel;
    type: 'date';
    required?: boolean;
    default?: Date;
};

export type CollectionConfigFieldDateTime = {
    name: string;
    label: CollectionConfigFieldLabel;
    type: 'datetime';
    required?: boolean;
    default?: Date;
};

export type CollectionConfigFieldList = {
    name: string;
    label: CollectionConfigFieldLabel;
    type: 'list';
    required?: boolean;
    fields: CollectionConfigFieldTypes[];
    default?: CollectionConfigFieldTypes[];
};

export type CollectionConfigFieldUpload = {
    name: string;
    label: CollectionConfigFieldLabel;
    type: 'upload';
    required?: boolean;
    default?: string;
};