/**
 * @name 算法SDK
 *
 * @class SDK
 *
 * @constructor
 * @param {Object} obj
 * @param {Object} obj.config   Darkmode配置
 * @param {Object} obj.tnQueue  文本队列
 * @param {Object} obj.bgStack  背景堆栈
 * @param {Object} obj.cssUtils 样式工具
 *
 * @method convert 处理节点
 * @param {DOM Object} el 要处理的节点
 * @returns {string} 处理后的css，包含css选择器
 *
 */

// dependencies
import Color from 'color';
import ColorName from 'color-name';
ColorName.windowtext = [0, 0, 0]; // 补上这个colorName
const colorNameReg = new RegExp(Object.keys(ColorName).join('|'), 'ig'); // 生成正则表达式来匹配这些colorName

import {
  CLASS_PREFIX,

  COLORATTR,
  BGCOLORATTR,
  ORIGINAL_COLORATTR,
  ORIGINAL_BGCOLORATTR,
  BGIMAGEATTR,

  TEXTCOLOR,
  DEFAULT_DARK_BGCOLOR,
  DEFAULT_LIGHT_BGCOLOR,

  DEFAULT_DARK_BGCOLOR_BRIGHTNESS,
  LIMIT_LOW_BGCOLOR_BRIGHTNESS,

  TABLE_NAME,

  IS_PC
} from './constant';

// 节点相关操作工具API
import {
  getChildrenAndIt,
  hasTextNode,
  hasTableClass
} from './domUtils';

export default class SDK {
  _idx = 0; // 索引值

  constructor({
    config,
    tnQueue,
    bgStack,
    cssUtils
  }) {
    this._config = config;
    this._tnQueue = tnQueue;
    this._bgStack = bgStack;
    this._cssUtils = cssUtils;
  }

  // 调整明度
  _adjustBrightness(color, el, options) {
    // 背景：
    // 处理原则：白背景改黑，其他高感知亮度背景调暗，低亮度适当提高亮度（感知亮度：https://www.w3.org/TR/AERT/#color-contrast）
    // 处理方法：黑白灰色（h=0，s=0）亮度大于40%时，做取反处理（darkmode默认底色亮度为14%）；感知亮度大于190，取190；其他亮度小于26%时，设为26%。
    // 遗留问题：高亮度背景高亮度字体有些case有问题（使用感知亮度算法解决大部分case）

    // 字体、边框：
    // 处理原则：高亮度字体压字体亮度(白色除外)，低亮度字体调亮（补充优化：带背景图片子元素字体颜色不变，带高感知亮度背景颜色子元素字体颜色不变），带背景图片字体补底色
    // 处理方法：亮度小于40%时，用（90%-该亮度），大于等于40%则保持不变；

    // 阴影
    // 处理原则：不转换

    // 原则：
    // - 用户设置为高亮字体颜色（接近白色亮度），不处理，保持高亮
    // - 用户设置的其他字体颜色，无背景颜色，低于感知亮度阈值提高感知亮度
    // - 用户设置的其他字体颜色，有背景颜色，根据调整后的背景颜色算出具有一定亮度差的字体颜色
    // - 用户设置了背景图片的字体颜色，暂不处理，不知道背景图片是量还是暗？？

    const hsl = color.hsl().array();
    const alpha = color.alpha();
    const whiteColorBrightness = 250;
    const limitBright = 190;
    const limitLowTextBright = 75;
    const LimitOffsetBrightness = 60;
    let rgb = color.rgb().array();
    let perceivedBrightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000; // 计算感知亮度
    let newColor;
    let extStyle = '';

    if (options.isBgColor) { // 背景色
      // 如果设置背景颜色，取消背景图片的影响
      if (el.getAttribute(BGIMAGEATTR) && alpha >= 0.05) {
        el.removeAttribute(BGIMAGEATTR);
      }

      if ((hsl[1] === 0 && hsl[2] > 40) || perceivedBrightness > whiteColorBrightness) {
        // 饱和度为0（黑白灰色），亮度大于40%或感知亮度大于250（白色）时，做亮度取反处理（Dark Mode 默认底色亮度为14%）
        newColor = Color.hsl(0, 0, Math.min(100, 100 + 14 - hsl[2]));
        // console.info('[背景] 白改黑，感知亮度%d：%c  测试  %c  测试  ', perceivedBrightness, `color:#fff;background:rgb(${rgb});`, `color:#fff;background:hsl(${hsl[0]},${hsl[1]}%,${hsl[2]}%)`);
      } else if (perceivedBrightness > limitBright) {
        // 感知亮度大于limitBright，将感知亮度设为limitBright
        const ratio = (limitBright * 1000) / (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114);
        newColor = Color.rgb(rgb[0] * ratio, rgb[1] * ratio, rgb[2] * ratio);
        // console.info('[背景] 调暗，感知亮度%d：%c  测试  %c  测试  ', perceivedBrightness, `color:#fff;background:rgb(${rgb});`, `color:#fff;background:rgb(${rgb[0] * ratio},${rgb[1] * ratio},${rgb[2] * ratio})`);
      } else if (hsl[2] < 26) {
        // 亮度小于26%，将亮度设为26%，适当提高亮度
        hsl[2] = 26;
        newColor = Color.hsl(...hsl);
        // console.info('[背景] 调亮，感知亮度%d：%c  测试  %c  测试  ', perceivedBrightness, `color:#fff;background:rgb(${rgb});`, `color:#fff;background:hsl(${hsl[0]},${hsl[1]}%,${hsl[2]}%)`);
      }

      if (!options.hasInlineColor) {
        const parentTextColor = el.getAttribute(COLORATTR) || TEXTCOLOR;
        const parentBgColorStr = newColor || color;
        // el.setAttribute(BGCOLORATTR, newColor || color)
        const ret = this._adjustBrightness(Color(parentTextColor), el, {
          isTextColor: true,
          parentElementBgColorStr: parentBgColorStr
        });
        if (ret.newColor) {
          extStyle += this._cssUtils.genCssKV('color', ret.newColor);
        } else {
          extStyle += this._cssUtils.genCssKV('color', parentTextColor);
        }
      }
    } else if (options.isTextColor || options.isBorderColor) { // 字体色、边框色
      const parentElementBgColorStr = options.parentElementBgColorStr || el.getAttribute(BGCOLORATTR) || DEFAULT_DARK_BGCOLOR;
      const parentElementBgColor = Color(parentElementBgColorStr);
      const parentElementBgColorRgb = parentElementBgColor.rgb().array();
      const parentElementBgColorHSL = parentElementBgColor.hsl().array();
      const parentElementBgColorAlpha = parentElementBgColor.alpha();
      const parentElementBGPerceivedBrightness = (parentElementBgColorRgb[0] * 299 + parentElementBgColorRgb[1] * 587 + parentElementBgColorRgb[2] * 114) / 1000;
      const parentElementBGWithOpacityPerceivedBrightness = parentElementBGPerceivedBrightness * parentElementBgColorAlpha + DEFAULT_DARK_BGCOLOR_BRIGHTNESS * (1 - parentElementBgColorAlpha);
      const adjustTextBrightnessByLimitBrightness = (rgbArray, limitLowBright) => {
        if (rgbArray[0] === 0 && rgbArray[1] === 0 && rgbArray[2] === 0) return Color.rgb(...rgbArray);
        const relativeBrightnessRatio = (limitLowBright * 1000) / (rgbArray[0] * 299 + rgbArray[1] * 587 + rgbArray[2] * 114);
        let newTextR = Math.min(255, rgbArray[0] * relativeBrightnessRatio);
        let newTextG = Math.min(255, rgbArray[1] * relativeBrightnessRatio);
        let newTextB = Math.min(255, rgbArray[2] * relativeBrightnessRatio);

        if (newTextG === 0) {
          newTextG = (limitLowBright * 1000 - newTextR * 299 - newTextB * 114) / 587;
        } else if (newTextR === 0) {
          newTextR = (limitLowBright * 1000 - newTextG * 587 - newTextB * 114) / 299;
        } else if (newTextB === 0) {
          newTextB = (limitLowBright * 1000 - newTextR * 299 - newTextG * 587) / 114;
        } else if (newTextR === 255 || newTextB === 255) {
          newTextG = (limitLowBright * 1000 - newTextR * 299 - newTextB * 114) / 587;
        } else if (newTextG === 255) {
          newTextB = (limitLowBright * 1000 - newTextR * 299 - newTextG * 587) / 114;
        }
        return Color.rgb(newTextR, newTextG, newTextB);
      };

      // 无背景图片
      if (!el.getAttribute(BGIMAGEATTR)) {
        // 用户设置为高亮字体颜色（接近白色亮度），不处理，保持高亮
        if (perceivedBrightness >= whiteColorBrightness) {
          // el.style.outline = '1px solid yellow';
        } else if (parentElementBGWithOpacityPerceivedBrightness <= LIMIT_LOW_BGCOLOR_BRIGHTNESS && perceivedBrightness < limitLowTextBright) {
          // 用户设置的其他字体颜色，无背景颜色或有低于阈值的背景颜色，低于感知亮度阈值的字体颜色提高感知亮度
          if (hsl[2] <= 40) {
            hsl[2] = 90 - hsl[2];
            rgb = Color.hsl(...hsl).rgb().array();
            perceivedBrightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
          }

          if (perceivedBrightness >= limitLowTextBright) {
            // el.style.outline = '1px solid red';
            newColor = Color.hsl(...hsl);
          } else {
            newColor = adjustTextBrightnessByLimitBrightness(rgb, limitLowTextBright);
          }
        } else {
          // 用户设置的其他字体颜色，有高于阈值感知亮度背景颜色，根据调整后的背景颜色算出具有一定亮度差的字体颜色
          const offsetPerceivedBrightness = Math.abs(parentElementBGWithOpacityPerceivedBrightness - perceivedBrightness);
          if (offsetPerceivedBrightness < LimitOffsetBrightness) {
            if (parentElementBGWithOpacityPerceivedBrightness > 100) {
              hsl[2] = 90 - hsl[2];
              let tmpRgb = Color.hsl(...hsl).rgb().array();
              let tmpPerceivedBrightness = (tmpRgb[0] * 299 + tmpRgb[1] * 587 + tmpRgb[2] * 114) / 1000;
              // 先以最小改动来修复这里的问题，后面再整理代码
              if (parentElementBGWithOpacityPerceivedBrightness - tmpPerceivedBrightness < LimitOffsetBrightness) {
                // console.log(Math.abs(parentElementBGWithOpacityPerceivedBrightness - tmpPerceivedBrightness), el);
                newColor = adjustTextBrightnessByLimitBrightness(tmpRgb, parentElementBGWithOpacityPerceivedBrightness - LimitOffsetBrightness);
              } else {
                newColor = Color.hsl(...hsl);
              }
            } else {
              hsl[2] = parentElementBgColorHSL[2] + 40;
              newColor = Color.hsl(...hsl);
            }
            // el.style.outline = '1px solid yellow';
            // newColor = Color.hsl(...hsl);
          }
        }
      }
    }
    return {
      newColor: newColor && newColor.alpha(alpha).rgb(),
      extStyle
    };
  }

  convert(el) {
    const nodeName = el.nodeName;

    if (this._config.whitelist.tagName.indexOf(nodeName) > -1) return '';

    const styles = el.style;
    let cssKV = ''; // css键值对
    let css = ''; // css

    const isTable = TABLE_NAME.indexOf(nodeName) > -1;
    let hasInlineColor = false; // 是否有自定义字体颜色
    let hasInlineBackground = false;
    let hasInlineBackgroundImage = false;
    let elBackgroundPositionAttr;
    let elBackgroundSizeAttr;
    // let hasNegativeMarginsAttr = false; // margin, margin-left, margin-top, margin-right, margin-bottom
    // let hasNewCSSStackingContextAttr = false; // opacity<1, transforms, filters
    // let isJSSetNewCSSStackingContextAttr = false;

    // styles.cssText 读出来的颜色统一是rgba格式，除了用英文定义颜色（如：black、white）
    const cssKVList = (styles.cssText && styles.cssText.split(';') || []).map(cssStr => { // 将cssStr转换为[key, value]，并清除各个元素的前后空白字符
      const splitIdx = cssStr.indexOf(':');
      return [cssStr.slice(0, splitIdx).toLowerCase(), cssStr.slice(splitIdx + 1)].map(item => (item || '').replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, ''));
    }).filter(([key, value]) => {
      if (key === 'color') {
        hasInlineColor = true;
      } else if (/background/i.test(key)) {
        hasInlineBackground = true;
        if (key === 'background-position') {
          elBackgroundPositionAttr = value;
        } else if (key === 'background-size') {
          elBackgroundSizeAttr = value;
        }
        // } else if ((key === 'opacity' && value < 1) || key === 'transform' || key === 'filter') {
        //   hasNewCSSStackingContextAttr = true;
        // } else if (/margin/i.test(key) && /-/.test(value)) {
        //   hasNegativeMarginsAttr = true;
      }

      if ((/background/i.test(key) || /^(-webkit-)?border-image/.test(key)) && /url\([^\)]*\)/i.test(value)) {
        hasInlineBackgroundImage = true;
      }

      // 过滤掉一些key
      return [
        '-webkit-border-image',
        'border-image',
        'color',
        'background-color',
        'background-image',
        'background',
        'border',
        'border-top',
        'border-right',
        'border-bottom',
        'border-left',
        'border-color',
        'border-top-color',
        'border-right-color',
        'border-bottom-color',
        'border-left-color'
      ].indexOf(key) > -1;
    }).sort(([key1], [key2]) => { // color属性放在最后
      if (key1 === 'color') {
        return 1;
      } else if (key1 === 'background-image' && key2 === 'background-color') { // 确保 background-image 在 background-color 后面
        return 1;
      }
      return -1;
    });

    if (isTable && !hasInlineBackground) { // 如果table没有内联样式
      let color = hasTableClass(el); // 获取class对应的lm色值
      if (!color) color = el.getAttribute('bgcolor'); // 如果没有class则获取bgcolor的色值
      if (color) { // 有色值（class对应的lm色值或者是bgcolor色值），则当做内联样式来处理
        cssKVList.unshift(['background-color', Color(color).toString()]);
        hasInlineBackground = true;
      }
    }

    cssKVList.forEach(([key, value]) => {
      const oldValue = value;
      let cssChange = false;

      // !important
      const importantReg = / !important$/;

      // 将英文定义颜色转换为rgb格式
      value = value.replace(importantReg, '').replace(colorNameReg, match => `rgb(${ColorName[match.toLowerCase()].toString()})`);

      // 找出色值来处理
      const colorReg = /rgba?\([^)]+\)/ig;
      const isBgColor = /^background/.test(key);
      const isTextColor = key === 'color';
      const isBorderColor = /^border/.test(key);
      const isGradient = /gradient/.test(value);
      const mixColor = colors => {
        if (!colors || colors.length < 1) return '';
        if (colors.length === 1) return colors[0];

        let retColor = colors.shift();
        let nextColor = colors.pop();
        while (nextColor) {
          retColor = Color(retColor).mix(Color(nextColor));
          nextColor = colors.pop();
        }

        return retColor;
      };
      let extStyle = '';
      let gradientColors = [];
      let gradientMixColor;

      if (!hasInlineBackgroundImage && colorReg.test(value)) {
        if (isGradient) {
          // 把原渐变色取出来
          value.replace(colorReg, match => gradientColors.push(match));

          // 计算出一个mix原色
          gradientMixColor = mixColor([].concat(gradientColors));
          // console.log(value, gradientColors, 'mix:', gradientMixColor) ;
        }
        value = value.replace(colorReg, match => {
          // 渐变色统一改成mix纯色
          if (isGradient) {
            match = gradientMixColor;
            cssChange = true;
          }

          // 使用颜色处理算法
          const ret = this._adjustBrightness(Color(match), el, {
            isBgColor,
            isTextColor,
            isBorderColor,
            hasInlineColor
          });
          const retColor = ret.newColor;

          extStyle += ret.extStyle;

          // 对背景颜色和文字颜色做继承传递，用于文字亮度计算
          if (isBgColor || isTextColor) {
            // isSetChildren = true;
            const attrName = isBgColor ? BGCOLORATTR : COLORATTR;
            const originalAttrName = isBgColor ? ORIGINAL_BGCOLORATTR : ORIGINAL_COLORATTR;
            const retColorStr = retColor ? retColor.toString() : match;
            getChildrenAndIt(el).forEach(dom => {
              dom.setAttribute(attrName, retColorStr);
              dom.setAttribute(originalAttrName, match);

              // 如果设置背景颜色，取消背景图片的影响
              if (isBgColor && Color(retColorStr).alpha() >= 0.05 && dom.getAttribute(BGIMAGEATTR)) {
                dom.removeAttribute(BGIMAGEATTR);
              }
            });
          }

          retColor && (cssChange = true);

          return retColor || match;
        }).replace(/\s?!\s?important/ig, '');
      }

      if (extStyle) {
        cssKV += extStyle;
      }

      if (!(el instanceof SVGElement)) { // 先不处理SVG
        // 背景图片、边框图片
        const isBackgroundAttr = /^background/.test(key);
        const isBorderImageAttr = /^(-webkit-)?border-image/.test(key);
        if ((isBackgroundAttr || isBorderImageAttr) && /url\([^\)]*\)/i.test(value)) {
          cssChange = true;
          let imgBgColor = el.getAttribute(ORIGINAL_BGCOLORATTR) || DEFAULT_LIGHT_BGCOLOR;
          const imgBgCover = 'rgba(0,0,0,0.1)';

          // 在背景图片下加一层原背景颜色：
          // background-image使用多层背景(注意background-position也要多加一层 https://www.w3.org/TR/css-backgrounds-3/#layering)；
          // border-image不支持多层背景，需要添加background-color
          value = value.replace(/^(.*?)url\(([^\)]*)\)(.*)$/i, (matches) => {
            let newValue = matches;
            let newBackgroundPositionValue = '';
            let newBackgroundSizeValue = '';
            let tmpCssKvStr = '';

            if (el.getAttribute(BGIMAGEATTR) !== '1') { // 避免重复setAttribute
              getChildrenAndIt(el).forEach(dom => dom.setAttribute(BGIMAGEATTR, '1'));
            }

            // background-image
            if (isBackgroundAttr) {
              newValue = `linear-gradient(${imgBgCover}, ${imgBgCover}),${matches}`;
              tmpCssKvStr = this._cssUtils.genCssKV(key, `${newValue},linear-gradient(${imgBgColor}, ${imgBgColor})`);
              if (elBackgroundPositionAttr) {
                newBackgroundPositionValue = `top left,${elBackgroundPositionAttr}`;
                cssKV += this._cssUtils.genCssKV('background-position', `${newBackgroundPositionValue}`);
                tmpCssKvStr += this._cssUtils.genCssKV('background-position', `${newBackgroundPositionValue},top left`);
              }
              if (elBackgroundSizeAttr) {
                newBackgroundSizeValue = `100%,${elBackgroundSizeAttr}`;
                cssKV += this._cssUtils.genCssKV('background-size', `${newBackgroundSizeValue}`);
                tmpCssKvStr += this._cssUtils.genCssKV('background-size', `${newBackgroundSizeValue},100%`);
              }
              this._bgStack.push(el, tmpCssKvStr); // 背景图入栈
            } else {
              // border-image元素，如果当前元素没有背景颜色，补背景颜色
              !hasInlineBackground && this._bgStack.push(el, this._cssUtils.genCssKV('background-image', `linear-gradient(${imgBgCover}, ${imgBgCover}),linear-gradient(${imgBgColor}, ${imgBgColor})`)); // 背景图入栈
            }
            return newValue;
          });

          // 没有设置自定义字体颜色，则使用非 Dark Mode 下默认字体颜色
          if (!hasInlineColor) {
            const textColor = el.getAttribute(ORIGINAL_COLORATTR) || TEXTCOLOR;
            cssKV += this._cssUtils.genCssKV('color', textColor);
            getChildrenAndIt(el).forEach(dom => dom.setAttribute(COLORATTR, textColor));
          }
        }
      }

      if (cssChange) {
        importantReg.test(oldValue) && (styles[key] = oldValue.replace(importantReg, '')); // 清除inline style的!important
        if (isGradient) {
          this._bgStack.push(el, this._cssUtils.genCssKV(key, value)); // 渐变入栈
        } else {
          cssKV += this._cssUtils.genCssKV(key, value);
        }
      }
    });

    // 问题：darkmode下为了降低图片亮度添加了filter，导致CSS渲染创建新的Stacking Contexts，影响节点层级
    // 解决办法：层级遮挡问题只会出现在margin为负值的情况下，所以为这些节点创建新的Stacking Contexts来提升层级
    // if (hasNegativeMarginsAttr === true && hasNewCSSStackingContextAttr === false && isJSSetNewCSSStackingContextAttr === false) {
    //   cssKV += this._cssUtils.genCssKV('transform', 'translateX(0)');
    //   isJSSetNewCSSStackingContextAttr = true;
    // }

    if (cssKV) { // 有处理过或者是背景图片就加class以及css
      IS_PC && el.setAttribute('data-style', styles.cssText); // PC端备份内联样式到data-style里，供编辑器做反处理
      const className = `${CLASS_PREFIX}${this._idx++}`;
      el.classList.add(className);
      css += (cssKV ? this._cssUtils.genCss(className, cssKV) : '');
    }

    if (hasTextNode(el)) { // 如果节点里有文本，要判断是否在背景图里
      if (this._config.delayBgJudge) { // 延迟背景判断
        this._tnQueue.push(el); // 文字入队
      } else {
        this._bgStack.contains(el, item => {
          css += this._cssUtils.genCss(item.className, item.cssKV);
        });
      }
    }

    return css;
  }
};