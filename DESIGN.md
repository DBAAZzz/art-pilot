## 设计规范

使用tailwindcss时需要遵循以下设计规范：

整体为极简风格，不需要多余的装饰和横线，不要随意添加shadow样式，除非我说明，一般不需要阴影效果（不要box-shadow、ring）

永远不要自己定义颜色，使用设计好的令牌，这很关键，如果真需要自定义颜色，需要询问后才能做决定！

先去看/Users/mac/Documents/workspace/DBAA/art-pilot/apps/desktop/src/index.css看有没有已经设计好的令牌，有的话尽量复用

正文字体都使用text-base，圆角使用默认rounded-lg，需要点击或者hover有变化的记得使用 cursor-pointer
