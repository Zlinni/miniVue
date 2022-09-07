import {
    createRoot,
    ElementTypes,
    NodeTypes
} from "./ast";
import {
    isVoidTag,
    isNativeTag
} from "./index";
import {
    camelize
} from "../utils";
// 设计模式
export function parse(content) {
    const context = createParserContext(content);
    const children = parseChildren(context);
    return createRoot(children);
}

function createParserContext(content) {
    return {
        // 编译选项
        options: {
            // 插值 vue的插值是可以换的
            delimiters: ["{{", "}}"],
            // 放到options是为了可以跨平台
            isVoidTag,
            isNativeTag
        },
        // 返回接收到的模板字符串
        source: content
    }
}

/**
 * @description: 对比插值节点和文本节点
 * @param {文本节点} context
 * @return {children数组}
 */
function parseChildren(context) {
    // parseChildren需要返回一个children
    const nodes = [];
    while (!isEnd(context)) {
        const s = context.source;
        let node;
        // 这里我们判断以{{开头则为插值节点，以<开头则为元素节点，其他就是文本节点
        if (s.startsWith(context.options.delimiters[0])) {
            //parseInterpolation
            node = parseInterpolation(context);
        } else if (s[0] === '<') {
            // parseElement
            node = parseElement(context);
        } else {
            // parseText
            node = parseText(context);
        }
        nodes.push(node);
    }
    let removedWhitespaces = false;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.type === NodeTypes.TEXT) {
            // 区分文本节点是否空白
            if (/[^\t\r\f\n ]/.test(node.content)) {
                // 文本节点有一些空白
                node.content = node.content.replace(/[\t\r\f\n ]+/g, ' ');
            } else {
                // 文本节点全是空白 分情况
                // 文本节点处于两个元素节点之间并且有换行符才能删 
                const prev = node[i - 1];
                const next = node[i + 1];
                if (!prev || !next || (prev.type === NodeTypes.ELEMENT && next.type === NodeTypes.ELEMENT && /[\r\n]/.test(node.content))) {
                    // 删除
                    removedWhitespaces = true;
                    nodes[i] = null;
                } else {
                    // 替换成一个空格
                    node.content = ' '
                }
            }
        }
    }
    // 如果里面没有删除也会执行filter造成损耗 所以给个标识
    return removedWhitespaces ? nodes.filter(Boolean) : nodes;
}
// 缺陷：
// a<b
// </
function parseText(context) {
    // 条件是<或者{{
    const endTokens = ['<', context.options.delimiters[0]];
    let endIndex = context.source.length;
    for (let i = 0; i < endTokens.length; i++) {
        let index = context.source.indexOf(endTokens[i]);
        // 缩小范围
        if (index !== -1 && index < endIndex) {
            endIndex = index;
        }
    }
    const content = parseTextData(context, endIndex);
    return {
        type: NodeTypes.TEXT,
        content
    }
}

function parseTextData(context, length) {
    const text = context.source.slice(0, length);
    // 去掉这一部分
    advanceBy(context, length);
    return text;
}

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
        } // 表达式节点
    }
}

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

function parseTag(context) {
    const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source);
    const tag = match[1];
    advanceBy(context, match[0].length);
    advanceSpaces(context);
    const {
        props,
        directives
    } = parseAttributes(context);
    // 判断是否自闭合
    const isSelfClosing = context.source.startsWith('/>');
    advanceBy(context, isSelfClosing ? 2 : 1);
    const tagType = isComponent(tag, context) ? ElementTypes.COMPONENT : ElementTypes.ELEMENT;
    return {
        type: NodeTypes.ELEMENT,
        tag, // 标签名,
        tagType, // 是组件还是原生元素,
        props, // 属性节点数组,
        directives, // 指令数组
        isSelfClosing, // 是否是自闭合标签,
        children: [],
    }
}

function isComponent(tag, context) {
    return !context.options.isNativeTag(tag)
}

function parseAttributes(context) {
    const props = [];
    const directives = [];
    // parseTag已经截断了 目标是<div id="foo" v-if="ok">且要判断自闭合 
    while (context.source.length && !context.source.startsWith('>') && !context.source.startsWith('/>')) {
        let attr = parseAttribute(context);
        if (attr.type === NodeTypes.DIRECTIVE) {
            directives.push(attr);
        } else {
            props.push(attr);
        }
    }
    return {
        props,
        directives
    };
}

function parseAttribute(context) {
    // 匹配并删除属性名
    const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source);
    const name = match[0];
    advanceBy(context, name.length);
    advanceSpaces(context);
    // 获取value 考虑value不存在的情况
    let value;
    if (context.source[0] === '=') {
        advanceBy(context, 1);
        advanceSpaces(context);
        value = parseAttributeValue(context);
        advanceSpaces(context);

    }
    // DIRECTIVE
    // 指令节点通过name判断 因为必然以v- : @开头
    if (/^(:|@|v-)/.test(name)) {
        let dirName, argContent;
        if (name[0] === ':') {
            dirName = 'bind';
            argContent = name.slice(1);
        } else if (name[0] === '@') {
            dirName = 'on';
            argContent = name.slice(1);
        } else if (name.startsWith('v-')) {
            // 此时还没考虑v-if的情况
            [dirName, argContent] = name.slice(2).split(':');
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
            } // 表达式节点
        }
    }

    // ATTRIBUTE
    return {
        type: NodeTypes.ATTRIBUTE,
        name,
        value: value && {
            type: NodeTypes.TEXT,
            content: value.content
        } // 纯文本节点
    }
}

function parseAttributeValue(context) {
    // id='foo' id=foo id="foo" 都是合法的 这里只考虑有引号的情况
    const quote = context.source[0];
    advanceBy(context, 1);
    const endIndex = context.source.indexOf(quote);
    const content = parseTextData(context, endIndex);
    // 'foo' => 'foo + '
    advanceBy(context, 1);
    return {
        content
    }
}

function isEnd(context) {
    const s = context.source;
    // s为空字符串,为</都代表结束了    
    return s.startsWith('</') || !s
}


// 需要两个工具类
/**
 * @description:返回截取的字符串 
 * @param {文本节点} context
 * @param {需要的字符串数量} numberOfCharacters
 * @return {截取的字符}
 */
function advanceBy(context, numberOfCharacters) {
    context.source = context.source.slice(numberOfCharacters);
}
/**
 * @description: 去掉所有空格
 * @param {*} context
 */
function advanceSpaces(context) {
    const match = /^[\t\r\n\f ]+/.exec(context.source);
    if (match) {
        advanceBy(context, match[0].length)
    }
}