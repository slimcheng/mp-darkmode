/**
 * @name 常量
 *
 */

export const MEDIA_QUERY = '(prefers-color-scheme: dark)'; // Dark Mode的CSS媒体查询

export const CLASS_PREFIX = 'js_darkmode__'; // Dark Mode class前缀

export const HTML_CLASS = 'data_color_scheme_dark'; // 强制设置暗黑模式时给html加的class

const RANDOM = `${new Date() * 1}${Math.round(Math.random() * 10)}`; // 生成个随机数，格式为时间戳+随机数
export const COLORATTR = `data-darkmode-color-${RANDOM}`;
export const BGCOLORATTR = `data-darkmode-bgcolor-${RANDOM}`;
export const ORIGINAL_COLORATTR = `data-darkmode-original-color-${RANDOM}`;
export const ORIGINAL_BGCOLORATTR = `data-darkmode-original-bgcolor-${RANDOM}`;
export const BGIMAGEATTR = `data-darkmode-bgimage-${RANDOM}`;

export const TEXTCOLOR = 'rgb(25,25,25)'; // 非Dark Mode下字体颜色
export const DEFAULT_DARK_BGCOLOR = '#191919'; // Dark Mode下背景颜色
export const DEFAULT_LIGHT_BGCOLOR = '#fff'; // 非Dark Mode下背景颜色
export const GRAY_MASK_COLOR = 'rgba(0,0,0,0.1)'; // 灰色蒙层色值

export const DEFAULT_DARK_BGCOLOR_BRIGHTNESS = 25;
export const LIMIT_LOW_BGCOLOR_BRIGHTNESS = 60;
export const DEFAULT_DARK_OFFSET_PERCEIVED_BRIGHTNESS = 138;

export const PAGE_HEIGHT = (window.getInnerHeight && window.getInnerHeight()) || window.innerHeight || document.documentElement.clientHeight;

export const TABLE_NAME = ['TABLE', 'TR', 'TD', 'TH']; // 支持bgcolor属性的table标签列表

const UA = navigator.userAgent;
export const IS_PC = (/windows\snt/i.test(UA) && !/Windows\sPhone/i.test(UA)) || (/mac\sos/i.test(UA) && !/(iPhone|iPad|iPod|iOS)/i.test(UA));