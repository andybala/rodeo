import _ from 'lodash';
import Immutable from 'seamless-immutable';
import {local} from '../../services/store';
import mapReducers from '../../services/map-reducers';
import reduxUtil from '../../services/redux-util';
import immutableUtil from '../../services/immutable-util';
import layoutDefinition from './layout.yml';
import layoutMapper from '../../services/layout-mapper';

const prefix = reduxUtil.fromFilenameToPrefix(__filename);

export function getInitialState() {
  let active;
  const preferenceMap = layoutMapper.define(layoutDefinition);

  if (preferenceMap && preferenceMap.length > 0) {
    active = _.head(preferenceMap).id;
  }

  return Immutable({
    active,
    preferenceMap,
    changes: {},
    canSave: true
  });
}

function getCurrentItemValueByKey(state, key) {
  const groupIndex = _.findIndex(state.preferenceMap, {id: state.active});

  if (groupIndex > -1) {
    const keyIndex = _.findIndex(state.preferenceMap[groupIndex].items, {key});

    if (keyIndex > -1) {
      return _.get(state, ['preferenceMap', groupIndex, 'items', keyIndex, 'value']);
    }
  }
}

/**
 * @param {object} state
 * @param {{key: string, value: string}} change
 * @returns {object}
 */
function updatePreferenceMapValueWithChange(state, change) {
  const key = change.key,
    groupIndex = _.findIndex(state.preferenceMap, {id: state.active});

  if (groupIndex > -1) {
    const keyIndex = _.findIndex(state.preferenceMap[groupIndex].items, {key});

    if (keyIndex > -1) {
      state = state.setIn(['preferenceMap', groupIndex, 'items', keyIndex, 'value'], change.value);
    }
  }

  return state;
}

/**
 * @param {object} state
 * @returns {object}
 */
function updateCanSave(state) {
  const canSave = _.every(state.changes, {state: 'valid'});

  if (state.canSave !== canSave) {
    state = state.set('canSave', canSave);
  }

  return state;
}

/**
 *
 * @param {object} state
 * @param {{change: {key: string, value: string}}} action
 * @returns {object}
 */
function changeSaved(state, action) {
  const key = action.change.key;

  state = updatePreferenceMapValueWithChange(state, action.change);

  if (state.changes[key]) {
    state = state.update('changes', changes => changes.without(key));
  }

  return updateCanSave(state);
}

function cancelAllChanges(state) {
  state = state.set('changes', {});
  state = state.set('canSave', true);
  return state;
}

function changeAdded(state, action) {
  const key = action.change.key;

  if (state.changes[key]) {
    const value = action.change.value,
      savedValue = local.get(action.change.key);

    if (savedValue === value) {
      state = state.update('changes', changes => changes.without(key));
    } else if (state.changes[key].value !== value) {
      state = state.setIn(
        ['changes', key],
        Immutable(_.pick(_.assign({}, state.changes[key], action.change), ['key', 'value', 'type', 'state']))
      );
    } // else we shouldn't change anything
  } else {
    state = state.setIn(['changes', key], _.defaults(action.change, {state: 'valid'}));
  }

  return updateCanSave(state);
}

function changeDetailAdded(state, action) {
  const changes = state.changes,
    change = action.change,
    key = change.key;

  if (changes[key] && changes[key].value === change.value) {
    state = state.setIn(['changes', key], Immutable(_.assign({}, changes[key], change)));
  }

  return updateCanSave(state);
}

function activeTabChanged(state, action) {
  return state.set('active', action.payload.active);
}

export default mapReducers(_.assign(reduxUtil.addPrefixToKeys(prefix, {
  ACTIVE_TAB_CHANGED: activeTabChanged,
  CANCEL_ALL_CHANGES: cancelAllChanges,
  CHANGE_ADDED: changeAdded,
  CHANGE_DETAIL_ADDED: changeDetailAdded
}), {
  PREFERENCE_CHANGE_SAVED: changeSaved
}), {});
