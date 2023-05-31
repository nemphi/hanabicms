import { Client } from "./client";
import { collection } from "./collections";

const a = collection({
    label: "test",
    fields: {
        test: {
            label: "test",
            type: "text",
            default: "test",
            required: false
        },
        test2: {
            label: "test2",
            type: "number",
            required: true,
            default: 2
        }
    },
    hooks: {
        beforeCreate: async (data) => {
            data.test = "test";
            data.test2 = 1;
            return data;
        }
    }
});

const aa = collection({
    label: "test",
    fields: {
        test3: {
            label: "test3",
            type: "date",
            default: new Date(0),
            required: true
        }
    },
    hooks: {
        beforeCreate: async (data) => {
            data.test3;
            return data;
        }
    }
});

// const z = test(a)



const b = new Client("http://localhost:3000", "test", {
    testa: a,
    asda: aa,
});

const c = b.collection("testa");

const g = await c.create({
    // test: "test",
    // test3: new Date(0),
    // test2: 1
    // test: "test",
    test2: 1
    // test3: new Date(0)
})


const d = await c.list()

d.records.forEach(r => {
    // r.data.test3;
    r.data.test;
    r.data.test2;
})