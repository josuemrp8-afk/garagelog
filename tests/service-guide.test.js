'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function app() {
  const elements = new Map();
  const context = vm.createContext({
    localStorage: { getItem: () => null, setItem() {} },
    document: {
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, {});
        return elements.get(selector);
      },
      addEventListener() {}
    },
    window: { addEventListener() {}, scrollTo() {} },
    navigator: {},
    location: { protocol: 'file:' }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), context);
  return expression => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
}

test('Miata requires confirmation that the US schedule applies', () => {
  const run = app();
  assert.equal(run("getMilestones({info:{year:'2001',make:'MAZDA',model:'MX-5'},serviceSchedule:'normal'}).length"), 0);
  assert.equal(run("getMilestones({info:{year:'2001',make:'MAZDA',model:'MX-5'},miataUSMarket:true,serviceSchedule:'normal'})[0].mo"), 6);
});

test('Sonic schedules use the 1.8 automatic and selected conditions', () => {
  const run = app();
  const info = "{year:'2013',make:'CHEVROLET',model:'Sonic',engine:'1.8L 4cyl',trans:'Automatic'}";
  assert.equal(run(`getMilestones({info:${info}}).length`), 0);
  assert.equal(run(`getMilestones({info:${info},sonicSchedule:'normal'}).length`), 0);
  assert.equal(run(`getMilestones({info:${info},sonicMarket:'us',sonicSchedule:'normal'}).find(m=>m.name==='Transmission fluid').mi`), 97500);
  assert.equal(run(`getMilestones({info:${info},sonicMarket:'us',sonicSchedule:'severe'}).find(m=>m.name==='Transmission fluid').mi`), 45000);
  assert.equal(run(`getMilestones({info:${info},sonicMarket:'canada',sonicSchedule:'severe'}).find(m=>m.name==='Transmission fluid').mi`), 44738);
  assert.equal(run(`getMilestones({info:${info},sonicMarket:'us',sonicSchedule:'normal'}).find(m=>m.name==='Engine oil & filter').manualOnly`), true);
  assert.equal(run("is2013Sonic({info:{year:'2013',make:'CHEVROLET',model:'Sonic',engine:'1.4L',trans:'Automatic'}})"), false);
});

test('GTI schedule requires confirmation and uses Canadian intervals', () => {
  const run = app();
  const info = "{year:'2023',make:'VOLKSWAGEN',model:''}";
  assert.equal(run(`getMilestones({info:${info}}).length`), 0);
  assert.equal(run(`getMilestones({info:${info},confirm2023Gti:true}).find(m=>m.name==='Transmission fluid').mi`), 74564);
  assert.equal(run(`getMilestones({info:${info},confirm2023Gti:true}).find(m=>m.name==='Spark plugs').mo`), 72);
  assert.equal(run(`getMilestones({info:${info},confirm2023Gti:true}).find(m=>m.name==='Front axle differential lock fluid').manualOnly`), true);
  assert.equal(run("canConfirm2023Gti({info:{year:'2023',make:'VOLKSWAGEN',model:'Jetta'}})"), false);
  assert.equal(run("canConfirm2023Gti({info:{year:'2023',make:'VOLKSWAGEN',model:'GTI',trans:'Manual'}})"), false);
});
