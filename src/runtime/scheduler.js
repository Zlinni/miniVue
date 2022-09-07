const queue = [];
let isFlushing = false;
let currentFlushPromise = null;
const resolvedPromise = Promise.resolve();
export function nextTick(fn){
    // 如果有在执行的promise则返回当前在执行的promise成功回调的结果，如果没有则返回一个新的promise的成功回调结果
    const p = currentFlushPromise || resolvedPromise;
    return fn?p.then(fn):p;
}
/**
 * @description: 
 * @param {effectFn} job
 * @return {*}
 */
export function queueJob(job) {
    if (!queue.length || !queue.includes(job)) {
        queue.push(job)
        // 清空队列的操作
        queueFlush()
    }
}

function queueFlush() {
    // 任务是否正在执行 不在的话才能进入promise 且要等每次promise执行完才能进入下一个任务
    if (!isFlushing) {
        isFlushing = true;
        currentFlushPromise = resolvedPromise.then(flushJobs)
    }
}
// 清空队列了
function flushJobs() {
    // 因为是用户代码可能会出错
    try {
        // 注意不能用len = queue.length 因为它可能在执行的时候继续添加
        for (let i = 0; i < queue.length; i++) {
            const job = queue[i];
            job();
        }
    } finally {
        isFlushing = false;
        queue.length = 0;
        currentFlushPromise = null;
    }
}