# fMP4 演示

演示如何利用 [mp4box.js](https://github.com/gpac/mp4box.js/) 实现对一般 MP4 视频在线转换为适用于 MSE 的分段视频流。

## 启动步骤

1. `npm install -g @svrx/cli`
2. 进入项目目录运行 `svrx -p http-ranges@0.0.3`
 
## 项目简单说明

- `svrx` 命令是 [Server-X](https://github.com/svrxjs/svrx) 
- `-p http-ranges@0.0.3` 选项是启用 [svrx-plugin-http-ranges](https://github.com/hsiaosiyuan0/svrx-plugin-http-ranges) 用作简单地支持 HTTP Range 请求，结合到一起就是在本地以项目目录为根目录，启动一个支持 HTTP Range 请求的 Web 服务
- 主要代码都在 [app.js](https://github.com/hsiaosiyuan0/fmp4-demo/blob/master/app.js) 中
- [1.mp4](https://github.com/hsiaosiyuan0/fmp4-demo/blob/master/1.mp4) 是演示用的视频
- 下载分段数据的任务通过 [Downloader](https://github.com/hsiaosiyuan0/fmp4-demo/blob/master/downloader.js) 完成

## 简单介绍 mp4box 的工作流程：

1. 先在顶层盒子中定位到 moov 的位置，下载并解析 moov 盒子的内容
2. 根据 moov 盒子的内容，生成 [initialization segment](https://w3c.github.io/media-source/isobmff-byte-stream-format.html#iso-init-segments)
3. 将 initialization segment 添加到先前打开的 [SourceBuffer](https://developer.mozilla.org/en-US/docs/Web/API/SourceBuffer) 中，这样 MSE 内部就获得了视频元数据
4. 利用 downloader 从第一个分段开始加载，即加载 [media segment](https://w3c.github.io/media-source/isobmff-byte-stream-format.html#iso-media-segments)
5. 如果接收到 seek 操作，测根据跳转的时间定位到分段的偏移量，利用 downloader 加载
6. downloader 加载好的数据先交给 mp4box 组装，每当其组装完成一个分段就会调用 onSegment 回调
7. 在 onSegment 回到中，拿到的就是经过 mp4box 组装好的，可以追加到 SourceBuffer 中的分段数据，所以进行追加操作
 
