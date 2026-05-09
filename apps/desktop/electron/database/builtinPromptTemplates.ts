import type { PromptPreviewImage, PromptSourceSite, PromptVariable } from '@art-pilot/shared'

export type BuiltinPromptTemplate = {
  id: string
  title: string
  content: string
  description?: string
  sourceSite: PromptSourceSite
  sourceUrl?: string
  sourceAuthor?: string
  originalSourceUrl?: string
  originalLanguage?: string
  categories: string[]
  previewImages: PromptPreviewImage[]
  variables: PromptVariable[]
  createdAt: number
  updatedAt: number
}

export const builtinPromptTemplates: BuiltinPromptTemplate[] = [
  {
    id: 'f0df0e95-832c-40e6-9023-76f1a6ef5b67',
    title: 'Chibi 风格剪贴簿照片转换',
    content: `移除{{user}}周围的人，在图片中添加多个小巧可爱的Q版“迷你版”主角。每个迷你角色都应拥有大头、富有表现力的面部特征，并与主角的发型和服装相匹配。
描绘每个迷你版在{{location}}进行不同的度假相关活动。
以剪贴簿的风格，用白色和粉色的墨水添加俏皮的手绘涂鸦和手写笔记，以增强图片的效果。包括箭头、星星、心形、亮片和粗线条等元素。
添加关于意大利米兰的可爱手写{{theme}}`,
    description: '一个创意提示词，旨在将个人照片转换为剪贴簿风格的布局，通过手绘涂鸦和个性化文字，呈现出主角各种活动的可爱 Chibi 版本。',
    sourceSite: 'youmind',
    sourceUrl: 'https://youmind.com/zh-CN/prompts/chibi-scrapbook-photo-edit-18363',
    sourceAuthor: 'Diego Jr',
    originalSourceUrl: 'https://x.com/CallMeDiegoJr/status/2051234005568090505',
    originalLanguage: 'en',
    categories: ['社交媒体帖子', '插画', 'Q 版 / Q 萌风', '角色', '文本 / 排版'],
    previewImages: [
      {
        url: 'https://cms-assets.youmind.com/media/1777971035859_ed4k2q_HHdyc2RWAAEUBLX.jpg',
        alt: 'Chibi 风格剪贴簿照片转换',
      },
    ],
    variables: [
      {
        key: 'location',
        label: '地点',
        type: 'text',
        required: true,
        defaultValue: '意大利',
      },
      {
        key: 'user',
        label: '主角',
        type: 'image',
        required: true,
        maxCount: 1,
        role: 'reference',
      },
      {
        key: 'theme',
        label: '主题',
        type: 'text',
        required: true,
        defaultValue: '度假主题短语',
      },
    ],
    createdAt: 1778144515822,
    updatedAt: 1778314177177,
  },
  {
    id: 'e97cf15b-e720-48d0-bc1b-26d146b97d07',
    title: '女性性感图',
    content: `超写实摄影，8K超清，最高画质，俯视第一人称视角，昏暗卧室，低光氛围，一个年轻的中国女性，黑色凌乱碎发，发丝垂落在脸上，含泪的眼睛，泛红的脸颊，皮肤带着水光和汗珠，微微张着嘴，眼神无助又脆弱地抬头看向镜头，她的脸被一只男人的手（观众视角）轻轻捧住，穿着红色丝绒露肩服饰，粉色荷叶边内衬，金色肩饰，造型华丽的金色大耳环，背景模糊的床铺和木地板，柔和的阴影，浅景深，亲密又忧郁的氛围，真实的皮肤纹理，电影感。
顶级画质，超写实人像摄影，8K，电影级低光照明，戏剧性柔光阴影，高角度俯视镜头，第一人称POV视角，年轻中国女性，黑色松散长发，几缕发丝贴在脸上，泪眼婆娑，眼神湿漉漉，脸颊绯红，皮肤带着薄汗的光泽，微微颤抖的嘴唇，带着委屈和依赖的表情抬头看向镜头，一只观众视角的男人手轻轻捧着她的脸颊，她穿着华丽的红色丝绒露肩装，粉色蕾丝镶边，金色肩章装饰，雕刻感的大型金色耳环，昏暗暧昧的卧室场景，背景虚化的床和木地板，亲密又压抑的氛围，真实的皮肤质感，清晰的泪痕，柔焦散景，轻微胶片颗粒。
低画质，模糊，变形，五官崩坏，畸形肢体，卡通，动漫，插画，3D渲染，CG，手绘，素描，多余的手指，缺失的手指，交叉眼，比例失调，扁平光影，高饱和，丑，怪异，扭曲，背景杂乱，面部不对称。`,
    sourceSite: 'manual',
    categories: ['女性'],
    previewImages: [],
    variables: [],
    createdAt: 1778299657580,
    updatedAt: 1778314198772,
  },
  {
    id: 'c7ef7e14-9d27-44b1-8bec-aecea4aaab4d',
    title: '电影级的Cosplay海报',
    content: `以 {{subject}} 为主体，创作一张电影级 Cosplay 竖版海报，画幅比例 2:3。人物保持 {{subject}} 的标志性面部特征、发型与服装设计，但整体转化为真实人类质感，呈现高端杂志封面与商业摄影结合的写真出道氛围，带有亲密、梦幻、微性感的日式美感。

人物采用 8.5 头身超模比例，姿态动态自然，身体语言开放而富有吸引力，眼神带有邀请感，手部动作丰富但不刻意。面部为日系缪斯感脸型，叠加 {{subject}} 的辨识特征：柔焦眼神、水润玻璃唇、通透肌肤、明显眼部高光。皮肤呈瓷白真实质感，包含次表面散射、细腻毛孔、细绒毛与油润高光；锁骨、颈线和身体曲线优雅清晰，整体具有强烈女性吸引力但保持高级克制。

发型高度还原 {{subject}} 的标志性造型，以真实沙龙级质感呈现，不像假发；发丝符合重力和重量感，有自然碎发、结构化定型与轻微反重力效果，并通过背光增强体积。服装高度还原 {{subject}} 原作设计，转译为高级定制级材质，使用真实奢华面料，保留原始轮廓与细节，让服装与身体自然贴合，裸露肌肤区域带有细腻光泽。

场景位于符合 {{subject}} 世界观设定的高预算电影布景中，结构有序但信息丰富，带轻微雾气、浅景深与散景效果。构图为近景到中景，人物是绝对视觉中心，部分身体或头发可以覆盖文字层，形成杂志封面的空间层次。整体风格高光泽、高对比、商业摄影质感强，画面有丰富的字体、材质与图层叠加，但保持高级秩序。

灯光采用电影级商业布光：冷色青色环境光与暖色肤色主光结合，加入头发轮廓光和高对比印刷质感，让皮肤、发丝、服装材质和背景层次清晰可见。

海报排版基于 {{subject}} 的世界观推导，使用严谨网格系统。加入日语主标题，标题具有张力和暗示感，使用高对比纤细衬线体，可带轻微斜体；加入 {{subject}} 的罗马音名称，使用中等字重衬线体；加入英文短叙述或标语，使用细衬线体；加入基于设定的圆形印章或徽章；角落放置 “Jerlin” 与期号，使用极细 Didot 风格、宽字距；加入条形码和价格标签。文字混排包含日语、平假名与罗马字，字重逐级递减。文字应作为构图框架的一部分，不要重复文字，不要文字阴影，不要发光效果，不要描边。`,
    sourceSite: 'manual',
    categories: ['cosplay'],
    previewImages: [],
    variables: [
      {
        key: 'subject',
        label: '人物',
        type: 'text',
        required: true,
      },
    ],
    createdAt: 1778302175270,
    updatedAt: 1778312322632,
  },
]
