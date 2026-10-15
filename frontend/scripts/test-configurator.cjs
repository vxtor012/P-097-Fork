const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, requireModule = require) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const loaded = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(output, {
    module: loaded, exports: loaded.exports, require: requireModule, URLSearchParams, Set, Date,
    fetch: () => { throw new Error('Configurator state checks must not call a live API.'); },
  }, { filename: file });
  return loaded.exports;
}

const data = load('lib/vehicle-data.ts');
const { VEHICLES, PROVINCES } = data;
const url = load('lib/config-url.ts', (name) => {
  if (name === '@/lib/vehicle-data') return data;
  throw new Error(`Unexpected URL module: ${name}`);
});

function makeCatalog() {
  const colors = [
    { id: 'white', label: 'White', hex: '#fff' },
    { id: 'green', label: 'Green', hex: '#030' },
    { id: 'red', label: 'Red', hex: '#d00' },
  ];
  const vehicle = (model) => ({ ...VEHICLES[model], colors, versions: [
    { id: 'live_eco', label: 'Eco', price: 100, colorPrices: { Green: 100 } },
    { id: 'live_plus', label: 'Plus', price: 200, colorPrices: { Red: 200 } },
  ] });
  return {
    vehicles: { VF6: vehicle('VF6'), VF7: vehicle('VF7'), VF9: vehicle('VF9') },
    provinces: {
      Hanoi: { ...PROVINCES.HN },
      Saigon: { ...PROVINCES.HCM },
    },
    accessories: [
      { id: 'dashcam', compatibleModels: [], label: 'All models', price: 1 },
      { id: 'vf6-only', compatibleModels: ['VF6'], label: 'VF6 accessory', price: 2 },
      { id: 'vf7-only', compatibleModels: ['VF7'], label: 'VF7 accessory', price: 3 },
    ],
  };
}

/** Exercise hook state transitions without a browser, database writes or network calls. */
function makeHarness(initial = {}, catalogData = makeCatalog()) {
  const states = [];
  let cursor = 0;
  let dirty = false;
  const useState = (initialState) => {
    const slot = cursor++;
    if (!(slot in states)) states[slot] = typeof initialState === 'function' ? initialState() : initialState;
    return [states[slot], (next) => {
      states[slot] = typeof next === 'function' ? next(states[slot]) : next;
      dirty = true;
    }];
  };
  const hook = load('hooks/use-configurator.ts', (name) => {
    if (name === 'react') return { useState };
    if (name === '@/lib/vehicle-data') return data;
    if (name === '@/lib/catalog-api') return {};
    if (name === '@/lib/query-client') return { getQueryClient() {} };
    if (name === '@tanstack/react-query') return {
      useQuery: ({ queryKey }) => {
        if (queryKey[0] === 'vehicle-catalog') return {
          data: catalogData, isError: false, isPending: !catalogData,
        };
        if (queryKey[0] === 'dealer-options') return { data: [{ id: 'dealer-1' }] };
        if (queryKey[0] === 'configuration-price') return { refetch() {}, isFetching: false };
        throw new Error(`Unexpected query: ${queryKey[0]}`);
      },
    };
    throw new Error(`Unexpected hook module: ${name}`);
  }).useConfigurator;
  return {
    setInitial(next) { initial = next; },
    setCatalog(next) { catalogData = next; },
    render() {
      let result;
      let attempts = 0;
      do {
        dirty = false;
        cursor = 0;
        result = hook(initial);
        assert.ok(++attempts < 10, 'Changing URL defaults must not cause a render loop');
      } while (dirty);
      return result;
    },
  };
}

function checkDirectEntry() {
  const empty = url.fromQuery(new URLSearchParams());
  const direct = makeHarness(empty).render();
  assert.equal(direct.config.model, 'VF6', 'Direct /configurator entry needs no model or homepage visit');
  assert.equal(direct.config.versionId, 'live_eco');
  assert.equal(direct.config.colorId, 'green');

  const shared = url.fromQuery(new URLSearchParams('dealer=dealer-1&province=HCM&battery=buy'));
  assert.equal(shared.model, undefined);
  assert.equal(shared.dealerId, 'dealer-1', 'Dealer links work without a model parameter');
  assert.equal(shared.provinceId, 'HCM');
  assert.equal(shared.battery, 'buy');
  const withDealer = makeHarness(shared).render();
  assert.equal(withDealer.config.dealerId, 'dealer-1');
  assert.equal(withDealer.config.provinceId, 'Saigon');
  assert.equal(withDealer.config.battery, 'buy');
  const invalid = url.fromQuery(new URLSearchParams('model=unknown&dealer=dealer-1'));
  assert.equal(makeHarness(invalid).render().config.model, 'VF6');
  assert.equal(invalid.dealerId, 'dealer-1');
}

function checkModelSwitch() {
  const harness = makeHarness({ model: 'VF6', versionId: 'vf6_plus', colorId: 'red',
    battery: 'buy', provinceId: 'HCM', dealerId: 'dealer-1', accessories: ['dashcam', 'vf6-only'] });
  let current = harness.render();
  assert.equal(current.config.versionId, 'live_plus', 'Legacy bookmarked version resolves to its live label');
  current.selectModel('VF7');
  current = harness.render();
  assert.equal(current.config.model, 'VF7');
  assert.equal(current.config.versionId, 'live_eco');
  assert.equal(current.config.colorId, 'green', 'Choose the first version-compatible color, not global white');
  assert.deepEqual(Array.from(current.config.accessories), ['dashcam']);
  assert.equal(current.config.battery, 'buy');
  assert.equal(current.config.provinceId, 'Saigon');
  assert.equal(current.config.dealerId, 'dealer-1');
  current.setField('versionId', 'live_plus');
  current = harness.render();
  assert.equal(current.config.colorId, 'red', 'Version changes reconcile incompatible colors');
  current.selectModel('VF7');
  current = harness.render();
  assert.equal(current.config.versionId, 'live_plus', 'Reselecting the same model preserves choices');
  current.toggleAccessory('vf6-only');
  current = harness.render();
  assert.deepEqual(Array.from(current.config.accessories), ['dashcam'], 'Incompatible accessories cannot be selected');
  current.toggleAccessory('vf7-only');
  current = harness.render();
  assert.deepEqual(Array.from(current.config.accessories), ['dashcam', 'vf7-only']);
  current.setField('model', 'VF9');
  current = harness.render();
  assert.equal(current.config.model, 'VF9', 'Existing setField model callers use the same switch behavior');
  assert.deepEqual(Array.from(current.config.accessories), ['dashcam']);
}

function checkCatalogAndUrlChanges() {
  const catalog = makeCatalog();
  const harness = makeHarness({ model: 'VF6', versionId: 'vf6_plus',
    accessories: ['dashcam', 'vf6-only'] }, null);
  let current = harness.render();
  assert.equal(current.config.versionId, 'vf6_plus');
  assert.equal(current.canQuote, false, 'Fallback choices do not authorize quotes');
  harness.setCatalog(catalog);
  current = harness.render();
  assert.equal(current.config.versionId, 'live_plus');
  assert.equal(current.config.colorId, 'red');
  assert.equal(current.pricingRequest.version, 'Plus', 'Pricing receives live labels after catalog arrival');
  harness.setCatalog({ ...catalog, accessories: catalog.accessories.filter((a) => a.id !== 'dashcam') });
  current = harness.render();
  assert.deepEqual(Array.from(current.pricingRequest.accessories), ['vf6-only'], 'Removed accessories cannot reach pricing');
  harness.setInitial({ model: 'VF9' });
  current = harness.render();
  assert.equal(current.config.model, 'VF9', 'Navigating to another model URL updates the same hook');
  assert.equal(current.config.versionId, 'live_eco');
  assert.equal(current.config.colorId, 'green');
  const roundTrip = url.fromQuery(new URLSearchParams(url.toQuery(current.config)));
  assert.deepEqual(JSON.parse(JSON.stringify(roundTrip)), JSON.parse(JSON.stringify(current.config)),
    'Quote navigation preserves the resolved configuration');
}

function checkAiUpdates() {
  const harness = makeHarness({ model: 'VF6' });
  let current = harness.render();
  const stale = current.config;
  current.selectModel('VF9');
  current = harness.render();
  const update = { model: 'VF 7', version: 'Plus', color: 'Red', province: PROVINCES.HN.label,
    battery: 'rent', accessories: ['dashcam', 'vf7-only', 'vf6-only'], dealer_id: 'dealer-1' };
  current.applyConfiguration(update, stale);
  current = harness.render();
  assert.equal(current.config.model, 'VF9', 'Late AI responses cannot overwrite a manual model switch');
  current.applyConfiguration(update, current.config);
  current = harness.render();
  assert.equal(current.config.model, 'VF7', 'An up-to-date AI response can switch the model');
  assert.equal(current.config.versionId, 'live_plus');
  assert.equal(current.config.colorId, 'red');
  assert.deepEqual(Array.from(current.config.accessories), ['dashcam', 'vf7-only']);
  const valid = JSON.stringify(current.config);
  current.applyConfiguration({ ...update, version: 'Eco' }, current.config);
  current = harness.render();
  assert.equal(JSON.stringify(current.config), valid, 'Reject an AI color unavailable for the requested version');
}

for (const check of [checkDirectEntry, checkModelSwitch, checkCatalogAndUrlChanges, checkAiUpdates]) check();
console.log('4 configurator regression scenarios passed: direct URLs, model changes, live catalog changes, AI updates.');
