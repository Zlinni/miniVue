import { parse } from "./compiler/index";
console.log(parse(`<div id="foo" v-if="ok">hello {{name}}</div>`))