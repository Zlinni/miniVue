# reactive的编写
reactive包含两个部分

一是将对象定义为响应式
二是执行effect副作用函数

## 为什么要写effect？
收集依赖，在依赖发生改变的时候触发更新

那就分成reativejs和effectjs两部分

## 判断对象和响应式处理
首先reativejs,将对象变成响应式，既然是对象，就要判断对象

需要去做对象的类型判断，如果不是对象就不做响应式

这里封装了一个类型判断函数到untils

然后使用proxy对依赖进行收集和更新

proxy接收两个参数，一个是target一个是handler

handler中简单的写一下get 和 set

get接收三个参数 target key receiver 目标对象 目标对象的值 接收者
set接收四个参数 target key value receiver

里面定义反射类型并返回出去

# effect的部分
再到effect部分
我们刚知道 effect产生的原因是 需要对依赖进行收集然后触发更新

用户调用对应的响应式对象就会触发更新

这里effect先接收一个函数，函数中调用了响应式的对象

## try对意外情况处理
这个函数一般是用户代码，可能出错 所以要使用try catch 这里不做catch 所以写finally

对依赖的收集在get 触发更新在set 分别对应vue中的track函数和trigger函数

下一步就是让effect和track trigger产生联系

## 依赖是否执行
我们要收集依赖，就要知道依赖有没有被执行，也就是有没有调用effect中传入的方法，所以我们要设计一个标识记录该方法，用到全局变量activeEffect，当该方法被执行的时候，将activeEffect赋值为该方法

这样，在track函数中，我们就可以判断了

## track的数据结构
我们拿到了activeEffect就要存起来，要怎么存储它呢。首先要分析我们需要存储的关系。

副作用执行=>响应式对象改变，响应式对象改变=>响应式对象的属性改变。

且一个属性可以被多个副作用依赖。

```javascript
// 一个targetMap
{
    [target]:{ //key是响应式对象 value是一个map
        [key]:[] //key是响应式对象的键值 value是一个set 
    }
}
```

首先所有的响应式对象(target)存储在一个targetMap里面，这个targetMap是一个weakMap，这样的话，里面的响应式对象在不使用的时候就会被垃圾回收。

然后响应式对象(target)里面的属性(key)存放在depsMap里面，depsMap是一个map，因为需要获取响应式对象的属性，和依赖的副作用

属性(key)中包含关联它的副作用，是一个set结构，因为一样的副作用不需要创建联系

## trigger
trigger就是track的逆运算，获取到响应式对象依赖的副作用函数然后循环执行

## 执行完函数还原activeEffect

## 处理特例
1. `reactive(reactive(obj))` 多次reactive只会处理一次
2. `let a = reactive(obj),b=reactive(obj)` 如果一个对象被代理了 则返回代理对象
3. `hasChanged`新旧值相同 则不触发副作用函数
4. 深层对象代理 多层次嵌套 
5. 嵌套effect

vue2会对所有的层次进行代理 而vue3就用了个懒代理的方式，不会对所有的层次进行处理，只处理需要的层次

嵌套effect的时候，首先是外层的被记录，然后内层的又执行，之后activeEffect被赋undefined，就结束了，内层的就无法被track

解决方法使用一个栈 标记后存放副作用然后结束的时候弹出末尾的副作用 再将末尾前一个的副作用记录下来

# ref

# computed









