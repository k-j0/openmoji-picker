
var OpenMoji = {

    Converter : class{

        /**
         * Builds the converter object
         * Possible settings:
         * - injectStyles: set to false to bypass loading css; only use if you're adding the stylesheet manually; defaults to true
         * - cssUrl: the path at which to find the stylesheet; defaults to "openmoji-picker/style.css"
         * - jsonUrl: the path at which to find the json file with all the data about the available openmoji emojis; defaults to "openmoji/data/openmoji.json"
         * - keepShorthands: set to false to convert text back to unicode emojis when calling `emojisToText` or when users copy and paste text; defaults to true
         * - baseEmojiUrl: the path at which to find all the different OpenMoji svg files, including trailing slash; defaults to "openmoji/color/svg/"
         */
        constructor(settings){

            this.settings = settings;

            /// Inject openmoji styles to <head>
            if(settings.injectStyles !== false){
                this.__get(settings.cssUrl ?? 'openmoji-picker/style.css').then((css) => {
                    let head = document.getElementsByTagName('head')[0];
                    let style = document.createElement('style');
                    style.innerHTML = css;
                    head.appendChild(style);
                });
            }

            /// Load OpenMoji data file
            this.__futureData = this.__get(settings.jsonUrl ?? 'openmoji/data/openmoji.json').then((data) => {
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
        }

        /// Returns the contents of a file
        __get(url){
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

        /// Creates & returns the markup required to display an emoji as an svg image
        makeEmojiImage(data){
            let shorthand = this.getEmojiShorthand(data.annotation);
            let classes = "openmoji" + (shorthand.includes('flag') ? " openmoji-smaller" : "");
            return '<img class="'+classes+'" data-shorthand="'+shorthand+'" data-emojiindex="'+data.index+'" \
                    src="'+(this.settings.baseEmojiUrl??"openmoji/color/svg/")+data.hexcode+'.svg" \
                    title="'+data.annotation+'" alt="'+shorthand+'">';
        }

        /// Returns the shorthand notation of an emoji
        getEmojiShorthand(annotation){
            return ':' + annotation.toLowerCase().replaceAll(' ', '-').replaceAll(':', '') + ':';
        }

        /// Converts some text containing unicode emojis or :shorthand-notations: to use svgs from openmoji instead
        textToEmojis(element){
            let input = element.innerHTML;
            console.log(element.selectionStart);
            if(element.tagName.toLowerCase() == "input"){
                console.error("Cannot convert text to emojis within an <input> field; use contenteditable instead!");
                return;
            }
            console.log("Converting [" + input + "] with type " + element.tagName.toLowerCase());
            return new Promise((resolve) => {
                this.__getData().then((data) => {
                    for(let i = data.length-1; i >= 0; --i){
                        data[i].index = i;
                        let emoji = this.makeEmojiImage(data[i]);
                        let shorthand = this.getEmojiShorthand(data[i].annotation);
                        input = input.replaceAll(shorthand, emoji);
                        input = input.replaceAll(data[i].emoji, emoji);
                    }
                    element.innerHTML = input;
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
                element.insertBefore(placeholder, emojis[i]);
                placeholder.replaceWith(emojis[i].getAttribute('alt'));
                toDelete.push(emojis[i]);
            }
            for(let i = toDelete.length - 1; i >= 0; --i){
                toDelete[i].remove();
            }
            return element.innerHTML;
        }

    }// class Converter

}// namespace OpenMoji
