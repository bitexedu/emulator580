'use strict';
// PC input contract requested by the user; does not change CASIO arithmetic.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
  const handlers={}, windows={}, clicks=[], buttons=new Map();
  const doc={modal:false, addEventListener:(type,fn)=>handlers[type]=fn,
    querySelector(selector) {
      if(selector==='dialog[open]') return this.modal ? {} : null;
      if(!buttons.has(selector)) {
        const classes=new Set();
        buttons.set(selector,{classes,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},click:()=>clicks.push(selector),focus:()=>{doc.activeElement=buttons.get(selector);},closest:s=>s==='.key'||s==='button,a,[role="button"]'?{}:null});
      }
      return buttons.get(selector);
    }};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'keyboard.js'),'utf8'),{
    document:doc,window:{addEventListener:(type,fn)=>windows[type]=fn},Map
  });
  const target={isContentEditable:false,closest:()=>null};
  function key(key,options={}) {
    const event={key,code:key,target:doc.activeElement || target,prevented:false,preventDefault(){this.prevented=true;},...options};
    handlers.keydown(event);return event;
  }
  return {key,doc,clicks,buttons,handlers,windows,target};
}
const action = a => '.key[data-action="'+a+'"]';
const digit = d => '.key[data-digit="'+d+'"]';
test('typing a complete expression routes through the same calculator keys',()=>{
 const x=setup(); for(const key of ['1','2','.','5','*','(','3','+','4',')','/','2','-','1','Enter'])assert.equal(x.key(key).prevented,true);
 assert.deepEqual(x.clicks,[digit(1),digit(2),action('dot'),digit(5),action('multiply'),action('open-paren'),digit(3),action('add'),digit(4),action('close-paren'),action('divide'),digit(2),action('subtract'),digit(1),action('equals')]);
});
test('number pad decimal separator and Enter work without treating NumLock-off Delete as a decimal',()=>{
 const x=setup(); x.key('7',{code:'Numpad7'});x.key(',',{code:'NumpadDecimal'});x.key('5',{code:'Numpad5'});x.key('Enter',{code:'NumpadEnter'});x.key('Delete',{code:'NumpadDecimal'});
 assert.deepEqual(x.clicks,[digit(7),action('dot'),digit(5),action('equals'),action('clear')]);
});
test('edit, arrows, mode and function keys reuse on-screen state handling',()=>{
 const x=setup();for(const k of ['Backspace','Escape','Delete','ArrowLeft','ArrowUp','ArrowRight','ArrowDown','m','o','c','x','f','^','F1','F2','='])x.key(k);
 assert.deepEqual(x.clicks,['delete','clear','clear','cursor-left','cursor-up','cursor-right','cursor-down','menu','optn','calc','input-x','fraction','power','shift','alpha','equals'].map(action));
});
test('browser shortcuts, input composition and unrelated keys are not consumed',()=>{
 const x=setup();for(const opts of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{keyCode:229},{defaultPrevented:true}])assert.equal(x.key('1',opts).prevented,false);
 for(const k of ['Shift','Alt','Tab',' ','F5','z'])assert.equal(x.key(k).prevented,false);
 assert.equal(x.clicks.length,0);x.key('+',{shiftKey:true});x.key('*',{shiftKey:true});assert.deepEqual(x.clicks,[action('add'),action('multiply')]);
});
test('feedback fields, editable content and every app dialog keep their own keyboard input',()=>{
 const x=setup();for(const tag of ['input','textarea','select','textbox']){
  const target={closest:selector=>selector.includes(tag==='textbox'?'[role="textbox"]':tag)?{}:null};
  assert.equal(x.key('1',{target}).prevented,false);
 }
 assert.equal(x.key('1',{target:{isContentEditable:true}}).prevented,false);
 x.doc.modal=true;for(const k of ['1','Enter','Escape','ArrowDown','F1'])assert.equal(x.key(k).prevented,false);
 assert.equal(x.clicks.length,0);
});
test('Enter on a focused calculator key is dispatched once; utility buttons keep native activation',()=>{
 const x=setup();const calculator={closest:s=>s==='.key'||s==='button,a,[role="button"]'?{}:null};
 assert.equal(x.key('Enter',{target:calculator}).prevented,true);assert.deepEqual(x.clicks,[action('equals')]);
 const utility={closest:s=>s==='button,a,[role="button"]'?{}:null};
 assert.equal(x.key('Enter',{target:utility}).prevented,false);assert.equal(x.clicks.length,1);
});
test('held modifiers do not toggle repeatedly; digit and deletion repetition still work',()=>{
 const x=setup();x.key('F1');x.key('F1',{repeat:true});x.key('Enter',{repeat:true});x.key('1');x.key('1',{repeat:true});x.key('Backspace',{repeat:true});
 assert.deepEqual(x.clicks,[action('shift'),digit(1),digit(1),action('delete')]);
});
test('key highlight clears on keyup and window blur',()=>{
 const x=setup();x.key('1',{code:'Digit1'});const one=x.buttons.get(digit(1));assert.equal(one.classes.has('keyboard-pressed'),true);
 x.handlers.keyup({code:'Digit1',key:'1'});assert.equal(one.classes.has('keyboard-pressed'),false);
 x.key('2');x.key('3');x.windows.blur();assert.equal([...x.buttons.values()].some(b=>b.classes.size),false);
});

test('typing after closing an app dialog restores calculator focus for Enter',()=>{
 const x=setup();const utility={closest:s=>s==='button,a,[role="button"]'?{}:null};
 x.doc.activeElement=utility;x.key('1');x.key('+');x.key('2');assert.equal(x.key('Enter').prevented,true);
 assert.deepEqual(x.clicks,[digit(1),action('add'),digit(2),action('equals')]);
});
