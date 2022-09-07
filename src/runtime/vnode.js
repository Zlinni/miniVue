/*
 * @Author: Zlinni 984328216@qq.com
 * @Date: 2022-06-01 22:20:46
 * @LastEditors: Zlinni 984328216@qq.com
 * @LastEditTime: 2022-06-12 20:25:57
 * @FilePath: \mini-vue\zMini-vue\src\runtime\vnode.js
 * @Description: 
 * 
 * Copyright (c) 2022 by Zlinni 984328216@qq.com, All Rights Reserved. 
 */
import { isArray, isNumber, isObject, isString } from "../utils";

export const ShapeFlags = {
    ELEMENT: 1, // 00000001
    TEXT: 1 << 1, // 00000010
    FRAGMENT: 1 << 2, // 00000100
    COMPONENT: 1 << 3, // 00001000
    TEXT_CHILDREN: 1 << 4, // 00010000
    ARRAY_CHILDREN: 1 << 5, // 00100000
    CHILDREN: (1 << 4) | (1 << 5), //00110000
};

export const Text = Symbol('Text');
export const Fragment = Symbol('Fragment');

/**
 * 
 * @param {String | Object | Text | Fragment} type 
 * @param {Object | null} props 
 * @param {String | Number | Array | null} children 
 * @returns VNode
 */
export function h(type,props,children){
    // 判断shapeFlag得到它的类型
    let shapeFlag = 0;
    if(isString(type)){
        shapeFlag = ShapeFlags.ELEMENT;
    }else if(type === Text){
        shapeFlag = ShapeFlags.TEXT;
    }else if(type === Fragment){
        shapeFlag = ShapeFlags.FRAGMENT
    }else {
        shapeFlag = ShapeFlags.COMPONENT;
    }
    // 再判断children
    if(isString(children)||isNumber(children)){
        shapeFlag |= ShapeFlags.TEXT_CHILDREN;
        // 数字转字符串
        children = children.toString();
    }else if(isArray(children)){
        shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
    }
    return{
        type,
        props,
        children,
        shapeFlag,
        el:null,
        anchor:null,
        key:props && props.key,
        component:null
    }
}

export function normalizeVNode(result){
    // 如果是个数组我们就用Fragment把他包装一下
    if(isArray(result)){
        return h(Fragment,null,result)
    }
    if(isObject(result)){
        return result;
    }
    // string||number
    return h(Text,null,result.toString())
}
