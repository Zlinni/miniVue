---
title: 从零开始的mini-vue⑧--parse篇
tags:
  - Vue
categories:
  - Vue系列
cover: ./img/vue系列/parse.jpg
abbrlink: 2151465192
date: 2022-06-14 10:37:48
---

# 前言

{% note primary flat %}
mini-Vue 是精简版本的 Vue3，包含了 vue3 源码中的核心内容，附加上 demo 的具体实现。
本篇是模板编译 Intro 篇，是关于 Vue3 中模板编译的简单介绍。
{% endnote %}

# 编译的目的

之前我们编译都是以手写渲染函数的形式进行的，因此进行模板编译的目的就是将模板代码编译成渲染函数

来看一下 vue 是怎么把模板编译成渲染函数的[](https://vue-next-template-explorer.netlify.app/)

![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/20220614105242.png)

这里的`_createElementBlock`就相当于 h 函数，`_toDisplayString`就是为了转换插值符号 msg 的结果

这里值得一提的是 vue 能支持 jsx 的原理，因为 jsx 的最终产物也是一段渲染函数。

# 编译的步骤

![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/20220614105756.png)

# parse

原始的模板代码就是一段字符串，通过解析 parse 转为原始的 AST 抽象语法树

# transform

AST 经过 transform 生成一个 codegenNode。codegenNode 是 AST 到生成渲染函数代码的中间步骤，它由原始的 AST 语义而得来。比如对于原始的 AST 来说：

```html
<div v-if="ok"></div>
<div id="ok"></div>
```

没什么区别，都是一个元素带有不同属性而已，但是 vif 的操作是带有特殊语义的，不能像纯元素节点一样采用同样的代码生成方式，transform 的作用就在此，一方面解析 AST，一方面为生成代码做准备。因此这一部分也是 vue compiler 模块最复杂的部分。

![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/8cb3d9f0fc34d823a7fe100627275dd.png)

# codegen

即是 code generate。遍历 codegenNode，递归生成最终的渲染函数代码

# Mini-Vue 的 compiler 实现原则

1. 只实现能够支撑流程跑通的最基本的功能
2. 舍弃所有的优化手段，选项功能
3. 假定所有的输入都是合法的（不做任何的语法容错处理）
4. 为了减少代码量，某些地方会使用一些与源码差别很大的简化手段
5. 会舍弃一些非常麻烦的实现

# 认识 AST

```html
<div id="foo" v-if="ok">hello {{name}}</div>
```

![](TODO)

AST 分为元素节点，属性节点，指令节点，文本节点和差值节点

## AST Node 的类型

其中 root 节点代表根节点，因为可能不止一个 root。SIMPLE_EXPRESSION 节点是简单表达式节点，附带在以上五种节点之中的节点，还有复杂表达式节点。

```javascript
const NodeTypes = {
  ROOT: "ROOT",
  ELEMENT: "ELEMENT",
  TEXT: "TEXT",
  SIMPLE_EXPRESSION: "SIMPLE_EXPRESSION",
  INTERPOLATION: "INTERPOLATION",
  ATTRIBUTE: "ATTRIBUTE",
  DIRECTIVE: "DIRECTIVE",
};

const ElementTypes = {
  ELEMENT: "ELEMENT",
  COMPONENT: "COMPONENT",
};
```

## 根节点

这里为了方便大大简化了。其实 vue 还有很多节点，用于优化的操作。所以这里只写了 children 方便我们执行。

```javascript
{
  type: NodeTypes.ROOT,
  children: [],
}
```

## 纯文本节点

相当于例子中的 hello

```javascript
{
  type: NodeTypes.TEXT,
  content: string
}
```

## 表达式节点

这个 content 相当于例子中的 name，isStatic 表示它是否是静态。静态的话说明 content 就是一段字符串，动态的话 content 是一个变量 or 一段 js 表达式

```javascript
{
  type: NodeTypes.SIMPLE_EXPRESSION,
  content: string,
  // 表达式是否静态。静态可以理解为content就是一段字符串；而动态的content指的是一个变量，或一段js表达式
  isStatic: boolean,
}
```

## 插值节点

包含了表达式节点，content 相当于例子中的 name，isStatic 是 false 说明 name 是一个变量

```javascript
{
  type: NodeTypes.INTERPOLATION,
  content: {
    type: NodeTypes.SIMPLE_EXPRESSION,
    content: string,
    isStatic: false,
  } // 表达式节点
}
```

## 元素节点

相当于例子中的 div，就是标签。当然因为也可以是自定义标签，比如组件类型，所以这里有个 tagType 标识是否是组件类型。然后属性节点和指令节点都在这里面

```javascript
{
  type: NodeTypes.ELEMENT,
  tag: string, // 标签名,
  tagType: ElementTypes, // 是组件还是原生元素,
  props: [], // 属性节点数组,
  directives: [], // 指令数组
  isSelfClosing: boolean, // 是否是自闭合标签,
  children: [],
}
```

## 属性节点

相当于例子中的 id，但这个属性节点是可以没有 value 值的，比如 checked

```javascript
{
  type: NodeTypes.ATTRIBUTE,
  name: string,
  value: undefined | {
    type: NodeTypes.TEXT,
    content: string,
  } // 纯文本节点
}
```

## 指令节点

在下一节中有

# 指令节点

例子

```html
<div v-bind:class="myClass" />

<div @click="handleClick" />
```

这个例子可以解析成以下的情况：
name: bind, arg: class, exp: myClass

name: on, arg: click, exp: handleClick

它的代码是

```javascript
{
  type: NodeTypes.DIRECTIVE,
  name: string,
  exp: undefined | {
    type: NodeTypes.SIMPLE_EXPRESSION,
    content: string,
    isStatic: false,
  }, // 表达式节点
  arg: undefined | {
    type: NodeTypes.SIMPLE_EXPRESSION,
    content: string,
    isStatic: true,
  } // 表达式节点
}
```

其中 exp 就是解析的变量或者表达式，arg 就是函数名称或者绑定的变量名称，当然也可以不存在，比如 v-if 就没有

# 示例的最终结果

`<div id="foo" v-if="ok">hello {{name}}</div>`

我们接下来要将这个模板例子编译成以下的状态

```json
{
  "type": "ROOT",
  "children": [
    {
      "type": "ELEMENT",
      "tag": "div",
      "tagType": "ELEMENT",
      "props": [
        {
          "type": "ATTRIBUTE",
          "name": "id",
          "value": { "type": "TEXT", "content": "foo" }
        }
      ],
      "directives": [
        {
          "type": "DIRECTIVE",
          "name": "if",
          "exp": {
            "type": "SIMPLE_EXPRESSION",
            "content": "ok",
            "isStatic": false
          }
        }
      ],
      "isSelfClosing": false,
      "children": [
        { "type": "TEXT", "content": "hello " },
        {
          "type": "INTERPOLATION",
          "content": {
            "type": "SIMPLE_EXPRESSION",
            "isStatic": false,
            "content": "name"
          }
        }
      ]
    }
  ]
}
```

# ast

首先我们创建 compiler 目录新建 ast,index 和 parse 三个 js

下面是 ast 通过 createRoot 接收 children 然后返回一个根节点和它的孩子

```javascript
export const NodeTypes = {
  ROOT: "ROOT",
  ELEMENT: "ELEMENT",
  TEXT: "TEXT",
  SIMPLE_EXPRESSION: "SIMPLE_EXPRESSION",
  INTERPOLATION: "INTERPOLATION",
  ATTRIBUTE: "ATTRIBUTE",
  DIRECTIVE: "DIRECTIVE",
};

export const ElementTypes = {
  ELEMENT: "ELEMENT",
  COMPONENT: "COMPONENT",
};

export function createRoot(children) {
  return {
    type: NodeTypes.ROOT,
    children,
  };
}
```

# parse

vue 采用了设计模式编写这一部分的内容

首先是我们的 parse 函数,接收一个 content,通过 createRoot 函数返回编译后的结果

```javascript
export function parse(content) {
  const context = createParserContext(content);
  const children = parseChildren(context);
  return createRoot(children);
}
```

## createParserContext

通过这个返回接收到的模板字符串和提供编译的选项

```javascript
function createParserContext(content) {
  return {
    // 编译选项
    options: {
      // 插值 vue的插值是可以换的
      delimiters: ["{{", "}}"],
    },
    // 返回接收到的模板字符串
    source: content,
  };
}
```

## parseChildren

在实现 parseChildren 之前我们需要两个工具函数

### advanceBy

我们的 vue 模板编译其实是像吃豆人一样的,需要一个一个字符串去消化,所以我们要根据情况截取字符串

```javascript
/**
 * @description:返回截取的字符串
 * @param {文本节点} context
 * @param {需要的字符串数量} numberOfCharacters
 * @return {截取的字符}
 */
function advanceBy(context, numberOfCharacters) {
  context.source = context.source.slice(numberOfCharacters);
}
```

### advanceSpaces

我们的 html 标签里面,其实也会有一些空格的情况出现,所以我们要去掉这些空格,否则会影响到我们的模板编译

```javascript
/**
 * @description: 去掉所有空格
 * @param {*} context
 */
function advanceSpaces(context) {
  const match = /^[\t\r\n\f ]+/.exec(context.source);
  if (match) {
    advanceBy(context, match[0].length);
  }
}
```

所以此时的 parseChildren 代码如下

```javascript
function parseChildren(context) {
  // parseChildren需要返回一个children
  const nodes = [];
  while (!isEnd(context)) {
    const s = context.source;
    let node;
    // 这里我们判断以 { 开头则为插值节点，以<开头则为元素节点，其他就是文本节点
    if (s.startsWith(context.options.delimiters[0])) {
      //parseInterpolation
      node = parseInterpolation(context);
    } else if (s[0] === "<") {
      // parseElement
      node = parseElement(context);
    } else {
      // parseText
      node = parseText(context);
    }
    nodes.push(node);
  }
  return nodes;
}
```

其中的循环条件函数为

### isEnd

```javascript
function isEnd(context) {
  const s = context.source;
  // s为空字符串,为</都代表结束了
  return s.startsWith("</") || !s;
}
```

之后分为文本节点，元素节点，插值节点的处理

## parseText

对于文本节点，我们可以用匹配的方式进行判断然后缩小范围。
比如`<div id="foo" v-if="ok">hello {{name}}</div>`
中，我们可以先匹配`<`,将范围缩小到`hello {{name}}`然后再匹配`{`缩小到`hello `最后利用 advanceBy 删除

```javascript
function parseText(context) {
  const endTokens = ["<", context.options.delimiters[0]];
  let endIndex = context.source.length;
  for (let i = 0; i < endTokens.length; i++) {
    let index = context.source.indexOf(endTokens[i]);
    // 缩小范围
    if (index != -1 && index < endIndex) {
      endIndex = index;
    }
  }
  const content = parseTextData(context, endIndex);
  return {
    type: NodeTypes.TEXT,
    content,
  };
}
```

不过上面的方法还是有缺陷，比如识别不了`a<b`或者`</`这样的符号就不行，当然插值后面有文本也不行

### parseTextData

```javascript
function parseTextData(context, length) {
  const text = context.source.slice(0, length);
  // 去掉这一部分
  advanceBy(context, length);
  return text;
}
```

## parseInterpolation

处理插值节点的思路就是找到前后的标识符，然后先去掉前面标识符的长度，再 parseTextData，最后再去掉后面标识符的长度。注意空格是合法的所以要对节点进行 trim

```javascript
function parseInterpolation(context) {
  const [open, close] = context.options.delimiters;
  advanceBy(context, open.length);
  const closeIndex = context.source.indexOf(close);
  // {{  name   }}也是合法的 所以要去掉空格
  const content = parseTextData(context, closeIndex).trim();
  advanceBy(context, close.length);
  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content,
      isStatic: false,
    }, // 表达式节点
  };
}
```

## parseElement

对于属性节点和指令节点我们放在 parseElement 里面去统一解析

`<div id="foo" v-if="ok">hello {{name}}</div>`

首先还是例子 对于这个例子来说，我们要解析出`<div id="foo" v-if="ok">`和`</div>`，那么前提就是要判断它的开始标签和结束标签，中间穿插这个解析

```javascript
start tag(解析属性，指令)
parseChildren(解析插值，文本)
end tag
```

对于标签，简单来说分为自闭合标签和非自闭合标签，所以我们单独写个函数分割

### parseTag

这一部分中，通过正则将标签匹配出来，然后吃掉标签和空格，接着拿到属性和指令内容(这一步留到后面写)。

由于我们的标签还分为 组件标签 和 元素标签 所以我们再写函数进行判断

```javascript
function parseTag(context) {
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source);
  const tag = match[1];
  advanceBy(context, match[0].length);
  advanceSpaces(context);
  const { props, directives } = parseAttributes(context);
  // 判断是否自闭合
  const isSelfClosing = context.source.startsWith("/>");
  advanceBy(context, isSelfClosing ? 2 : 1);
  const tagType = isComponent(tag, context)
    ? ElementTypes.COMPONENT
    : ElementTypes.ELEMENT;
  return {
    type: NodeTypes.ELEMENT,
    tag, // 标签名,
    tagType, // 是组件还是原生元素,
    props, // 属性节点数组,
    directives, // 指令数组
    isSelfClosing, // 是否是自闭合标签,
    children: [],
  };
}
```

此时发现辨析标签比较困难，引入 vue 提供的解析标签到`index.js`

```javascript
const HTML_TAGS =
  "html,body,base,head,link,meta,style,title,address,article,aside,footer," +
  "header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,div,dd,dl,dt,figcaption," +
  "figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code," +
  "data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,s,samp,small,span,strong,sub,sup," +
  "time,u,var,wbr,area,audio,map,track,video,embed,object,param,source," +
  "canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td," +
  "th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup," +
  "option,output,progress,select,textarea,details,dialog,menu," +
  "summary,template,blockquote,iframe,tfoot";

const VOID_TAGS =
  "area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr";

function makeMap(str) {
  const map = str
    .split(",")
    .reduce((map, item) => ((map[item] = true), map), Object.create(null));
  return (val) => !!map[val];
}

export const isVoidTag = makeMap(VOID_TAGS);
export const isNativeTag = makeMap(HTML_TAGS);

export { parse } from "./parse";
export { NodeTypes } from "./ast";
export { compile } from "./compile";
```

并在配置项里增加

```javascript
function createParserContext(content) {
  return {
    // 编译选项
    options: {
      // 插值 vue的插值是可以换的
      delimiters: ["{{", "}}"],
      // 放到options是为了可以跨平台
      isVoidTag,
      isNativeTag,
    },
    // 返回接收到的模板字符串
    source: content,
  };
}
```

此时我们的 isComponent 函数就可以编写了

```javascript
function isComponent(tag, context) {
  return !context.options.isNativeTag(tag);
}
```

回到 parseElement，因为有了这个标签判断方法，大致的 js 如下

```javascript
function parseElement(context) {
  // start tag
  const element = parseTag(context);
  // 其实这里判断自闭合这个条件还不够，eg:<input>
  // 所以引入了index中的isVoidTag
  if (element.isSelfClosing || context.options.isVoidTag(element.tag)) {
    return element;
  }
  // parseChildren
  element.children = parseChildren(context);
  // end Tag
  parseTag(context);
  return element;
}
```

现在解决刚刚留下来的 parseAttributes，解析属性和指令节点

### parseAttributes

parseTag 中已经帮我们截断了标签。所以目标是`<div id="foo" v-if="ok">`，不过我们依然需要判断是否自闭合，才进行解析。

```javascript
function parseAttributes(context) {
  const props = [];
  const directives = [];
  // parseTag已经截断了 目标是<div id="foo" v-if="ok">且要判断自闭合
  while (
    context.source.length &&
    !context.source.startsWith(">") &&
    !context.source.startsWith("/>")
  ) {
    let attr = parseAttribute(context);
    if (attr.type === NodeTypes.DIRECTIVE) {
      directives.push(attr);
    } else {
      props.push(attr);
    }
  }
  return {
    props,
    directives,
  };
}
```

这里的解析又需要用到`parseAttribute`方法

#### parseAttribute

这个方法是为了匹配并删除属性名产生的，匹配完之后，对于属性节点我们要获取等号后的内容，不过我们知道也不是时常有等号的，比如:`checked`就是没有等号也成立的内容，所以进一步封装方法 parseAttributeValue。对于指令节点，我们通过 match 后的 name 判断，因为指令节点一般以`:`,`@`,`v-`开头，分类判断，最后返回。不过我们在最后处理返回值的时候也要注意会有类似`my-class`的情况。要将他去掉-转为小驼峰才能识别`myClass`，需要个工具类函数帮助我们

```javascript
function parseAttribute(context) {
  // 匹配并删除属性名
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source);
  const name = match[0];
  advanceBy(context, name.length);
  advanceSpaces(context);
  // 获取value 考虑value不存在的情况
  let value;
  if (context.source[0] === "=") {
    advanceBy(context, 1);
    advanceSpaces(context);
    value = parseAttributeValue(context);
    advanceSpaces(context);
  }
  // DIRECTIVE
  // 指令节点通过name判断 因为必然以v- : @开头
  if (/^(:|@|v-)/.test(name)) {
    let dirName, argContent;
    if (name[0] === ":") {
      dirName = "bind";
      argContent = name.slice(1);
    } else if (name[0] === "@") {
      dirName = "on";
      argContent = name.slice(1);
    } else if (name.startsWith("v-")) {
      // 此时还没考虑v-if的情况
      [dirName, argContent] = name.slice(2).split(":");
    }
    return {
      type: NodeTypes.DIRECTIVE,
      name: dirName,
      exp: value && {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: value.content,
        isStatic: false,
      }, // 表达式节点
      arg: argContent && {
        type: NodeTypes.SIMPLE_EXPRESSION,
        // 注意:my-class的情况 value会将他转为驼峰
        content: camelize(argContent),
        isStatic: true,
      }, // 表达式节点
    };
  }
  // ATTRIBUTE
  return {
    type: NodeTypes.ATTRIBUTE,
    name,
    value: value && {
      type: NodeTypes.TEXT,
      content: value.content,
    }, // 纯文本节点
  };
}
```

##### parseAttributeValue

对于等号后的内容，其实不加引号和加引号都是合法的，这里偷个懒，认为输入的必须加引号才成立。方法就是获取第一个字符后匹配最后一个 index，再通过 parseTextData 获取内容, 最后删掉那个多余的引号

```javascript
function parseAttributeValue(context) {
  // id='foo' id=foo id="foo" 都是合法的 这里只考虑有引号的情况
  const quote = context.source[0];
  advanceBy(context, 1);
  const endIndex = context.source.indexOf(quote);
  const content = parseTextData(context, endIndex);
  // 'foo' => 'foo + '
  advanceBy(context, 1);
  return {
    content,
  };
}
```

##### camelize

工具类中的转小驼峰的方法，例子是

```javascript
// my-first-class-
// myFirstClass
```

代码

```javascript
export function camelize(str) {
  // 第一个参数是匹配到的字符，第二个参数是括号分组后匹配的字符
  return str.replace(/-(\w)/g, (_, c) => {
    c ? c.toUpperCase() : "";
  });
}
```

# whitespace 优化

例子

```html
<!-- <div>
  foo

      bar
</div> -->

<div>
  <span>a</span>
  <span>b</span>
  <span>c</span>
</div>
```

这个例子中，如果我们采用原来的解析方法，会多了很多`/r/n`之类的不必要字符，算做了文本节点，所以这里有个优化的方法

```javascript
let removedWhitespaces = false;
for (let i = 0; i < nodes.length; i++) {
  const node = nodes[i];
  if (node.type === NodeTypes.TEXT) {
    // 区分文本节点是否空白
    if (/[^\t\r\f\n ]/.test(node.content)) {
      // 文本节点有一些空白
      node.content = node.content.replace(/[\t\r\f\n ]+/g, " ");
    } else {
      // 文本节点全是空白 分情况
      // 文本节点处于两个元素节点之间并且有换行符才能删
      const prev = node[i - 1];
      const next = node[i + 1];
      if (
        !prev ||
        !next ||
        (prev.type === NodeTypes.ELEMENT &&
          next.type === NodeTypes.ELEMENT &&
          /[\r\n]/.test(node.content))
      ) {
        // 删除
        removedWhitespaces = true;
        nodes[i] = null;
      } else {
        // 替换成一个空格
        node.content = " ";
      }
    }
  }
}
// 如果里面没有删除也会执行filter造成损耗 所以给个标识
return removedWhitespaces ? nodes.filter(Boolean) : nodes;
```

之后跑代码
```javascript
import { parse } from "./compiler/index";
console.log(parse(`<div id="foo" v-if="ok">hello {{name}}</div>`))
```

如果结果如下 说明基本是正确的
![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/20220619115543.png)



