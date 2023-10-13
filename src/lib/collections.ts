import { Rec } from "../api/records";

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
    unique: boolean;
    version?: number;
    access?: CollectionAccess;
    hooks?: {
        beforeCreate?: (data: FieldValues<T>) => Promise<FieldValues<T>>;
        afterCreate?: (data: Rec<T>) => Promise<void>;
        // beforeRead?: () => Promise<void>;
        // afterRead?: (data: FieldValues<T>) => Promise<FieldValues<T>>;
        beforeUpdate?: (old: Rec<T>, updated: FieldValues<T>) => Promise<FieldValues<T>>;
        afterUpdate?: (old: Rec<T>, updated: Rec<T>) => Promise<void>;
        beforeDelete?: (data: Rec<T>) => Promise<void>;
        afterDelete?: (data: Rec<T>) => Promise<void>;
        newVersion?: (oldData: Rec<T>, oldVersion: number, newVersion: number) => Promise<FieldValues<T>>;
    }
}

export function collection<T extends CollectionFields>(config: CollectionConfig<T>): CollectionConfig<T> {
    return config;
}

type collectionType<T extends CollectionFields> = {
    fields: T;
    unique: boolean;
}

export type TypedCollections<T extends Record<string, CollectionConfig<CollectionFields>>> = {
    [P in keyof T]: T[P] extends CollectionConfig<infer U> ? collectionType<U> : never;
}

export function typedCollections<T extends {
    [P in keyof T]: T[P] extends CollectionConfig<infer U> ? CollectionConfig<U> : never;
}>(collections: T): TypedCollections<T> {
    const cols: Partial<TypedCollections<T>> = {};
    Object.keys(collections).forEach((key) => {
        const typedKey = key as keyof T;
        cols[typedKey] = {
            fields: collections[typedKey].fields,
            unique: collections[typedKey].unique,
        } as T[keyof T] extends CollectionConfig<infer U extends CollectionFields> ? collectionType<U> : never;
    })
    return cols as TypedCollections<T>;
}

export type FieldValues<T extends CollectionFields> = {
    [P in keyof T]: T[P]["required"] extends true ? T[P]["default"] : T[P]["default"] | null;
}


export type ConfigFieldTypes = ConfigFieldText |
    ConfigFieldNumber |
    ConfigFieldDate |
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
    filter?: boolean;
};

export type ConfigFieldNumber = {
    label: CollectionConfigFieldLabel;
    type: 'number';
    required: boolean;
    default: number;
    filter?: boolean;
}

export type ConfigFieldDate = {
    label: CollectionConfigFieldLabel;
    type: 'date';
    required: boolean;
    default: Date;
    filter?: boolean;
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
    removeOnUpdate: boolean;
    removeOnDelete: boolean;
    default: string | File | null;
};