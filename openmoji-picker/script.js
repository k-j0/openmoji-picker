
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

        /// Returns whether the child node is nested within the parent node
        static isDescendant(child, parent){
            if(child === parent) return true;
            var node = child.parentNode;
            while(node){
                if(node === parent) return true;
                node = node.parentNode;
            }
            return false;
        }

    },// class Utils

    Converter : class{

        /**
         * Builds the converter object
         * Possible settings:
         * - injectStyles: set to false to bypass loading css; only use if you're adding the stylesheet manually; defaults to true
         * - cssUrl: the path at which to find the stylesheet; defaults to "openmoji-picker/style.css"
         * - jsonUrl: the path at which to find the json file with all the data about the available openmoji emojis; defaults to "openmoji/data/openmoji.json"
         * - keepShorthands: set to false to convert text back to unicode emojis when calling `emojisToText` or when users copy and paste text; defaults to true
         * - allowEmoticons: set to false to prevent converting emoticons like "<3" to openmoji; defaults to true
         * - baseEmojiUrl: the path at which to find all the different OpenMoji svg files, including trailing slash; defaults to "openmoji/color/svg/"
         * - baseBWEmojiUrl: the path at which to find all the different OpenMoji black/white svg files, including trailing slash; defaults to baseEmojiUrl+"/../../black/svg/"
         * - readonlyClassName: the html class to use to find readonly openmoji content; defaults to "openmoji-readonly"
         * - editableClassName: the html class to use to find editable content; defaults to "openmoji-editable"
         * - pickerMixinClassName: the html class to use to find elements where pickers should be inserted; defaults to "with-openmoji-picker"
         * - scaleEmojis: if true, openmojis will be slightly scaled up; defaults to true
         * - verbose: if true, will log debug information to the console; can also be set to the string literal "full"; defaults to false
         */
        constructor(settings){
            settings = settings ?? {};

            this.settings = settings;

            // Features needed to ensure proper functionality
            MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

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
                // parse the data to divide into emoji groups
                let groups = {};
                this.__data.forEach((emojiData, index) => {
                    // catch emojis with duplicate annotations
                    // @todo: for now only White Flag exists twice, but this could use sturdier/more flexible code
                    if(emojiData.annotation === "white flag" && emojiData.tags != "waving"){
                        emojiData.annotation = "flat white flag";
                        emojiData.skintone_base_emoji = emojiData.emoji;
                        emojiData.emoji = null; // unmap from emoji
                        this.__data[index] = emojiData;
                    }
                    // Sort emojis into groups
                    let groupName = emojiData.group;
                    let baseEmoji = emojiData.skintone_base_emoji;
                    if(baseEmoji === "") baseEmoji = emojiData.emoji;
                    // apply special rules
                    if(groupName == "food-drink" && emojiData.subgroups == "food-marine") groupName = "animals-nature"; // these fellas aren't food!
                    switch(groupName){
                        case "people-body":
                        case "component":
                            groupName = "smileys-emotion";
                            break;
                        case "extras-openmoji":
                        case "extras-unicode":
                            groupName = emojiData.subgroups;
                            switch(groupName){
                                case "brand": groupName = "symbols"; break;
                                case "climate-environment": groupName = "animals-nature"; break;
                                case "emergency": groupName = "activities"; break;
                                case "gardening": groupName = "activities"; break;
                                case "healthcare": groupName = "activities"; break;
                                case "interaction": groupName = "symbols"; break;
                                case "people": groupName = "activities"; break;
                                case "subdivision-flag": groupName = "flags"; break;
                                case "symbol-other": groupName = "symbols"; break;
                                case "technology": groupName = "objects"; break;
                                case "ui-element": groupName = "symbols"; break;
                            }
                            break;
                    }
                    if(!(groupName in groups)){
                        let group = { count: 0, emojis: {}, index: Object.keys(groups).length };
                        // assign header emoji
                        switch(groupName){
                            case "activities":
                                group.icon = "1F3C0"; // basketball
                                break;
                            case "animals-nature":
                                group.icon = "1FAB4"; // potted plant
                                break;
                            case "flags":
                                group.icon = "1F6A9"; // triangular flag
                                break;
                            case "food-drink":
                                group.icon = "1FAD0"; // blueberries
                                break;
                            case "objects":
                                group.icon = "1F4A1"; // light bulb
                                break;
                            case "smileys-emotion":
                                group.icon = "1F604"; // grinning face with smiling eyes
                                break;
                            case "symbols":
                                group.icon = "267B"; // recycling symbol
                                break;
                            case "travel-places":
                                group.icon = "1F6E9"; // small airplane
                                break;
                            default:
                                group.icon = "1F990"; // shrimp
                                break;
                        }
                        groups[groupName] = group;
                    }
                    if(!(baseEmoji in groups[groupName].emojis)){
                        ++groups[groupName].count;
                        groups[groupName].emojis[baseEmoji] = [];
                    }
                    groups[groupName].emojis[baseEmoji].push(emojiData);
                });
                // reformat groups to an indexed array
                this.groups = [];
                Object.keys(groups).forEach((groupName) => {
                    let group = groups[groupName];
                    group.name = groupName;
                    this.groups[group.index] = group;
                    delete group.index;
                });
                if(this.settings.verbose) console.log("Loaded OpenMoji data", this.__data, "divided into groups", this.groups);
            });

            /// Fired once DOM becomes interactable
            OpenMoji.Utils.whenReady(() => {

                /// Look for any openmoji-readonly elements and set up events on them
                let readonlys = document.getElementsByClassName(settings.readonlyClassName ?? 'openmoji-readonly');
                [...readonlys].forEach(readonly => {
                    this.bindReadonly(readonly);
                });

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

        /// Returns the OpenMoji data asynchronously (as soon as it's available)
        getData(){
            return new Promise((resolve) => {
                if(this.__data !== undefined){
                    resolve(this.__data);
                }else{
                    this.__futureData.then(() => {
                        resolve(this.__data);
                    });
                }
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
            let additionalAttributes = (this.settings.scaleEmojis !== false ? "scaled" : "");
            return '<img class="'+classes+'" data-shorthand="'+shorthand+'" data-emojiindex="'+data.index+'" \
                    src="' + this.getEmojiSvgPath(data.hexcode) + '" \
                    title="'+data.annotation+'" alt="'+shorthand+'" ' + additionalAttributes + '>';
        }

        /// Returns the shorthand notation of an emoji
        getEmojiShorthand(annotation){
            return ':' + annotation.toLowerCase().replaceAll(' ', '-').replaceAll(':', '') + ':';
        }

        /// Converts emoticons in text to :shorthand-notation:
        emoticonsToShorthands(text){
            text = text.replaceAll('&lt;3&lt;3&lt;3 ', ':sparkling-heart::sparkling-heart::sparkling-heart: ')
                       .replaceAll('&lt;3 ', ':red-heart: ')
                       .replaceAll('&lt;/3 ', ':broken-heart: ')
                       .replaceAll(':) ', ':slightly-smiling-face: ')
                       .replaceAll('=) ', ':slightly-smiling-face: ')
                       .replaceAll(':* ', ':kissing-face-with-closed-eyes: ')
                       .replaceAll(';* ', ':face-blowing-a-kiss: ')
                       .replaceAll('^^ ', ':smiling-face-with-smiling-eyes: ')
                       .replaceAll('^_^ ', ':smiling-face-with-smiling-eyes: ')
                       .replaceAll(':D ', ':grinning-face-with-smiling-eyes: ')
                       .replaceAll('=D ', ':grinning-face-with-smiling-eyes: ')
                       .replaceAll('8) ', ':smiling-face-with-sunglasses: ')
                       .replaceAll(';) ', ':winking-face: ')
                       .replaceAll(':P ', ':face-savoring-food: ')
                       .replaceAll(':p ', ':face-with-tongue: ')
                       .replaceAll(';p ', ':winking-face-with-tongue: ')
                       .replaceAll(':/ ', ':confused-face: ')
                       .replaceAll('=/ ', ':confused-face: ')
                       .replaceAll(':\\ ', ':confused-face: ')
                       .replaceAll('=\\ ', ':confused-face: ')
                       .replaceAll(':| ', ':neutral-face: ')
                       .replaceAll('=| ', ':neutral-face: ')
                       .replaceAll('-_- ', ':expressionless-face: ')
                       .replaceAll(':o ', ':face-with-open-mouth: ')
                       .replaceAll(':O ', ':exploding-head: ')
                       .replaceAll(":'( ", ':crying-face: ')
                       .replaceAll("='( ", ':crying-face: ')
                       .replaceAll("&gt;:( ", ':pouting-face: ')
                       .replaceAll("&gt;=( ", ':pouting-face: ')
                       .replaceAll(':( ', ':frowning-face: ')
                       .replaceAll('=( ', ':frowning-face: ')
                       .replaceAll(')D&gt;- ', ':tongue::victory-hand: ')
                       .replaceAll(':o) ', ':clown-face: ')
                       .replaceAll('=o) ', ':clown-face: ')
                       .replaceAll('(: ', ':upside-down-face: ')
                       .replaceAll('(= ', ':upside-down-face: ');
            return text;
        }

        /// Converts some text containing unicode emojis or :shorthand-notations: to use svgs from openmoji instead
        textToEmojis(element){
            this.emojisToText(element);
            let input = element.innerHTML;
            if(this.settings.verbose === "full") console.log("Converting text to emoji:", input);
            if(element.tagName.toLowerCase() == "input"){
                console.error("Cannot convert text to emojis within an <input> field; use contenteditable instead!");
                return;
            }
            return new Promise((resolve) => {
                this.getData().then((data) => {
                    // replace emoticons by :shorthands: in text
                    if(this.settings.allowEmoticons !== false){
                        input = this.emoticonsToShorthands(input);
                        if(this.settings.verbose === "full") console.log("After conversion to emoticons:", input);
                    }
                    // replace emojis and :shorthands: in text
                    for(let i = data.length-1; i >= 0; --i){
                        data[i].index = i;
                        let emoji = this.makeEmojiImage(data[i]);
                        let shorthand = this.getEmojiShorthand(data[i].annotation);
                        if(data[i].emoji !== null)
                            input = input.replaceAll(data[i].emoji, shorthand);
                        input = input.replaceAll(shorthand, emoji);
                    }
                    // replace content with new openmoji content
                    element.innerHTML = input;
                    if(this.settings.verbose === "full") console.log("After conversion from shorthands and emoji:", input);
                    // replace shorthands with actual emojis in alt tags
                    if(this.settings.keepShorthands === false){
                        let emojisAdded = element.getElementsByClassName('openmoji');
                        for(let i = 0; i < emojisAdded.length; ++i){
                            emojisAdded[i].setAttribute('alt', data[emojisAdded[i].getAttribute('data-emojiindex')].emoji);
                        }
                    }
                    if(this.settings.verbose === "full") console.log("Conversion finished:", element.innerHTML);
                    resolve(element.innerHTML);
                });
            });
        }

        /// Converts some text containing openmojis back to unicode or shorthand, depending on the settings applied
        emojisToText(element){
            if(this.settings.verbose === "full") console.log("Converting emoji to text:", element.innerHTML);
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

        /// Adds openmoji support to the element; anytime it changes, textToEmojis will be called for it
        bindReadonly(element){
            this.textToEmojis(element);
            let observe = (observer) => {
                observer.observe(element, {
                    subtree: true,
                    childList: true
                });
            };
            let observer = new MutationObserver(() => {
                observer.disconnect();
                if(this.settings.verbose === "full") console.log("Updating openmoji-readonly contents for", element);
                this.textToEmojis(element).then(() => {
                    observe(observer);
                });
            });
            observe(observer);
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
            let pickerInstance = null;

            OpenMoji.Utils.get(this.getEmojiSvgPath('1F60A', false)).then((response) => {
                picker.innerHTML = response;
                OpenMoji.Utils.get(this.getEmojiSvgPath('1F604', true)).then((response) => {
                    picker.innerHTML += response;

                    picker.addEventListener('click', () => {
                        if(!pickerInstance){
                            pickerInstance = new OpenMoji.Picker(picker, this);
                        }else{
                            pickerInstance.toggleVisibility();
                        }
                    });
                })
            });

        }

    },// class Converter

    Picker : class{

        /**
         * Displays the openmoji picker as coming out of the specified HTML element
         */
        constructor(originNode, converter){
            this.originNode = originNode;

            // build picker panel
            this.pickerElem = document.createElement('div');
            this.pickerElem.className = "openmoji-picker";
            this.pickerElem.tabIndex = "-1";
            this.pickerElem.title = "";
            this.pickerElem.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            document.addEventListener('click', (e) => {
                if(this.shown && !OpenMoji.Utils.isDescendant(e.target, this.pickerElem) && e.target !== this.originNode)
                    this.hide();
            });
            this.hide();
            originNode.appendChild(this.pickerElem);

            // build top container (search icon and input)
            let top = document.createElement('div');
            this.pickerElem.appendChild(top);
            top.className = 'openmoji-picker-top';
            top.title = "Search for emoji by name";
            OpenMoji.Utils.get(converter.getEmojiSvgPath('1F50E', false)).then((response) => {
                top.innerHTML = response;// search icon as svg node
                let input = document.createElement('input');
                top.appendChild(input);
                input.setAttribute('type', 'text');
                input.setAttribute('placeholder', 'Search emoji');
            });

            // build category tabs & emoji div
            let categories = document.createElement('div');
            let emojiContainer = document.createElement('div');
            this.pickerElem.appendChild(categories);
            this.pickerElem.appendChild(emojiContainer);
            categories.className = 'openmoji-picker-categories';
            emojiContainer.className = 'openmoji-picker-emoji-container';
            let selectCategory = function(categoryButton, group){
                categoryButton.setAttribute('selected', '');
                // display emojis to select from
            }
            let unselectCategory = function(categoryButton){
                categoryButton.removeAttribute('selected');
            }
            converter.groups.forEach((group, index) => {
                let tabButton = document.createElement('div');
                categories.appendChild(tabButton);
                tabButton.className = 'openmoji-picker-category-button';
                tabButton.setAttribute('title', group.name.replace('-', ' & '));
                tabButton.setAttribute('alt', "Select emoji category: "+group.name.replace('-', ' and '));
                tabButton.emojiCategory = index;
                tabButton.setAttribute('emoji-category', index);
                if(index <= 0){
                    selectCategory(tabButton, group);
                }
                OpenMoji.Utils.get(converter.getEmojiSvgPath(group.icon, false)).then((response) => {
                    tabButton.innerHTML = response;// default icon
                    OpenMoji.Utils.get(converter.getEmojiSvgPath(group.icon)).then((response) => {
                        tabButton.innerHTML += response;// hover icon
                        tabButton.addEventListener('click', () => {
                            [...categories.childNodes].forEach((categoryButton) => {
                                unselectCategory(categoryButton);
                            });
                            selectCategory(tabButton, group);
                        });
                    });
                });
            });

            this.show();
        }

        /**
         * Closes the picker element
         */
        hide(){
            this.pickerElem.setAttribute('aria-hidden', '');
            this.shown = false;
        }

        /**
         * Opens the picker element after it's been closed
         */
        show(){
            // place element at a good spot to be as visible as possible
            let aabb = this.originNode.getBoundingClientRect();
            let center = {x: (aabb.left + Math.abs(aabb.width)/2), y: (aabb.top + Math.abs(aabb.height)/2)};
            let fromTop = center.y < document.documentElement.clientHeight / 2;
            let fromLeft = center.x < document.documentElement.clientWidth / 2;
            this.pickerElem.setAttribute('from', (fromTop ? "top" : "bottom")+'-'+(fromLeft ? "left" : "right"));

            this.pickerElem.removeAttribute('aria-hidden');
            this.shown = true;
        }

        /**
         * Toggles between hide() and show()
         */
        toggleVisibility(){
            if(this.shown) this.hide();
            else this.show();
        }

    }// class Picker

}// namespace OpenMoji
