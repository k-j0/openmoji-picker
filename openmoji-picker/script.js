
var OpenMoji = {

    Utils : class{
        /// Ensures the callback function is called, either immediately or once the DOM becomes interactable
        static whenReady(callback){
            if(document.readyState === "complete" || document.readyState === "interactive") {
                callback();
            }else{
                window.addEventListener('DOMContentLoaded', () => {
                    callback();
                });
            }
        }

        /// Performs a simple GET request on a resource and returns the response text within a Promise
        static get(url){
            return new Promise(function(resolve){
                let httpGet = new XMLHttpRequest();
                httpGet.onreadystatechange = function(){
                    if(httpGet.readyState == 4 && httpGet.status == 200){
                        resolve(httpGet.responseText);
                    }
                }
                httpGet.open('GET', url, true);
                httpGet.send(null);
            });
        }
    },

    Converter : class{

        /**
         * Builds the converter object
         * Possible settings:
         * - injectStyles: set to false to bypass loading css; only use if you're adding the stylesheet manually; defaults to true
         * - cssUrl: the path at which to find the stylesheet; defaults to "openmoji-picker/style.css"
         * - jsonUrl: the path at which to find the json file with all the data about the available openmoji emojis; defaults to "openmoji/data/openmoji.json"
         * - keepShorthands: set to false to convert text back to unicode emojis when calling `emojisToText` or when users copy and paste text; defaults to true
         * - baseEmojiUrl: the path at which to find all the different OpenMoji svg files, including trailing slash; defaults to "openmoji/color/svg/"
         * - baseBWEmojiUrl: the path at which to find all the different OpenMoji black/white svg files, including trailing slash; defaults to baseEmojiUrl+"/../../black/svg/"
         * - editableClassName: the html class to use on editable content; defaults to "openmoji-editable"
         * - pickerMixinClassName: the html class to use on elements where pickers should be inserted; defaults to "with-openmoji-picker"
         */
        constructor(settings){
            settings = settings ?? {};

            this.settings = settings;

            /// Inject openmoji styles to <head>
            if(settings.injectStyles !== false){
                OpenMoji.Utils.get(settings.cssUrl ?? 'openmoji-picker/style.css').then((css) => {
                    let head = document.getElementsByTagName('head')[0];
                    let style = document.createElement('style');
                    style.innerHTML = css;
                    head.appendChild(style);
                });
            }

            /// Load OpenMoji data file
            this.__futureData = OpenMoji.Utils.get(settings.jsonUrl ?? 'openmoji/data/openmoji.json').then((data) => {
                this.__data = JSON.parse(data);
            });
            this.__getData = function(){
                return new Promise((resolve) => {
                    if(this.__data !== undefined) resolve(this.__data);
                    this.__futureData.then(() => {
                        resolve(this.__data);
                    });
                });
            }

            /// Fired once DOM becomes interactable
            OpenMoji.Utils.whenReady(() => {

                /// Look for any openmoji-editable elements and instantiate them as editable openmoji fields
                let editables = document.getElementsByClassName(settings.editableClassName ?? 'openmoji-editable');
                [...editables].forEach(editable => {
                    this.bindEditable(editable);
                });

                /// Add picker elements to any DOM nodes with class with-openmoji-picker
                let pickers = document.getElementsByClassName(settings.pickerMixinClassName ?? 'with-openmoji-picker');
                [...pickers].forEach(picker => {
                    this.bindPickerButton(picker);
                });
            });
        }

        /// Returns the SVG path for an openmoji given its hexcode
        getEmojiSvgPath(hexcode, colour = true){
            let basePath = this.settings.baseEmojiUrl ?? "openmoji/color/svg/";
            if(!colour){
                if(this.settings.baseBWEmojiUrl == undefined){
                    basePath = basePath + "../../black/svg/";
                }else{
                    basePath = this.settings.baseBWEmojiUrl;
                }
            }
            return basePath + hexcode + '.svg';
        }

        /// Creates & returns the markup required to display an emoji as an svg image
        makeEmojiImage(data){
            let shorthand = this.getEmojiShorthand(data.annotation);
            let classes = "openmoji" + (shorthand.includes('flag') ? " openmoji-smaller" : "");
            return '<img class="'+classes+'" data-shorthand="'+shorthand+'" data-emojiindex="'+data.index+'" \
                    src="' + this.getEmojiSvgPath(data.hexcode) + '" \
                    title="'+data.annotation+'" alt="'+shorthand+'">';
        }

        /// Returns the shorthand notation of an emoji
        getEmojiShorthand(annotation){
            return ':' + annotation.toLowerCase().replaceAll(' ', '-').replaceAll(':', '') + ':';
        }

        /// Converts some text containing unicode emojis or :shorthand-notations: to use svgs from openmoji instead
        textToEmojis(element){
            this.emojisToText(element);
            let input = element.innerHTML;
            if(element.tagName.toLowerCase() == "input"){
                console.error("Cannot convert text to emojis within an <input> field; use contenteditable instead!");
                return;
            }
            return new Promise((resolve) => {
                this.__getData().then((data) => {
                    // replace emojis and :shorthands: in text
                    for(let i = data.length-1; i >= 0; --i){
                        data[i].index = i;
                        let emoji = this.makeEmojiImage(data[i]);
                        let shorthand = this.getEmojiShorthand(data[i].annotation);
                        input = input.replaceAll(shorthand, emoji);
                        input = input.replaceAll(data[i].emoji, emoji);
                    }
                    // replace content with new openmoji content
                    element.innerHTML = input;
                    // replace shorthands with actual emojis in alt tags
                    if(this.settings.keepShorthands === false){
                        let emojisAdded = element.getElementsByClassName('openmoji');
                        for(let i = 0; i < emojisAdded.length; ++i){
                            emojisAdded[i].setAttribute('alt', data[emojisAdded[i].getAttribute('data-emojiindex')].emoji);
                        }
                    }
                    resolve(element.innerHTML);
                });
            });
        }

        /// Converts some text containing openmojis back to unicode or shorthand, depending on the settings applied
        emojisToText(element){
            let emojis = element.getElementsByClassName('openmoji');
            let toDelete = [];
            for(let i = 0; i < emojis.length; ++i){
                let placeholder = document.createElement('span');
                emojis[i].parentNode.insertBefore(placeholder, emojis[i]);
                placeholder.replaceWith(emojis[i].getAttribute('alt'));
                toDelete.push(emojis[i]);
            }
            for(let i = toDelete.length - 1; i >= 0; --i){
                toDelete[i].remove();
            }
            return element.innerHTML;
        }

        /// Makes the element editable (with support for openmoji)
        bindEditable(element){
            if(element.tagName.toLowerCase() == "input"){
                console.error("Cannot convert text to emojis within an <input> field; use <div>s instead.");
                return;
            }
            let child = document.createElement('div');
            // transfer contents of the original element to the child element
            child.innerHTML = element.innerHTML;
            element.innerHTML = "";
            element.removeAttribute('contenteditable');
            element.appendChild(child);
            // make child editable
            child.className = "openmoji-editable-input";
            child.setAttribute('contenteditable', '');
            this.textToEmojis(child);
            // bind events
            child.addEventListener('blur', e => {
                this.textToEmojis(child);
            });
            // add functionality to the parent element for ease
            element.getInputElement = () => { return child; };
            element.getTextValue = () => { return child.innerHTML; };
        }

        /// Adds an openmoji picker to the element
        bindPickerButton(element){

            let picker = document.createElement('div');
            element.appendChild(picker);
            picker.className = 'openmoji-picker-button';
            picker.setAttribute('title', 'Insert emoji');
            picker.setAttribute('alt', 'Insert emoji');

            OpenMoji.Utils.get(this.getEmojiSvgPath('1F60A', false)).then((response) => {
                picker.innerHTML = response;
                OpenMoji.Utils.get(this.getEmojiSvgPath('1F604', true)).then((response) => {
                    picker.innerHTML += response;
                })
            });

        }

    }// class Converter

}// namespace OpenMoji
