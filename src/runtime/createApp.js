/*
 * @Author: Zlinni 984328216@qq.com
 * @Date: 2022-06-08 15:41:57
 * @LastEditors: Zlinni 984328216@qq.com
 * @LastEditTime: 2022-06-13 19:33:48
 * @FilePath: \mini-vue\zMini-vue\src\runtime\createApp.js
 * @Description: 
 * 
 * Copyright (c) 2022 by Zlinni 984328216@qq.com, All Rights Reserved. 
 */

import { isString } from "../utils";
import { render } from "./render";
import { h } from "./vnode";

/**
 * @description: 
 * @param {组件} rootComponent
 * @return {组件的实例}
 */
export function createApp(rootComponent){
  const app = {
    mount(rootContainer){
      // 如果它是字符串就把他转换成DOM对象
      if(isString(rootContainer)){
        rootContainer = document.querySelector(rootContainer); 
      }
      render(h(rootComponent),rootContainer);
    }
  }
  return app;
}