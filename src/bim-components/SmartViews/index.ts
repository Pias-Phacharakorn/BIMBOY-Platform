// @ts-nocheck
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { DataMap } from "@thatopen/fragments";
import { SmartView } from "./src";

export class SmartViews extends OBC.Component implements OBC.Disposable {
  static uuid = "cf03d41c-2e36-4026-a14a-67a7995c4bb2" as const;
  readonly list = new DataMap<string, SmartView>();
  enabled = true;
  readonly onDisposed = new OBC.Event<string>();

  currentState: SmartView = {
    name: "SmartView",
    defaultVisibility: true,
    visibilityExceptions: {},
    colors: {},
  };

  constructor(components: OBC.Components) {
    super(components);
    components.add(SmartViews.uuid, this);
  }

  dispose() {
    this.list.clear();
    this.onDisposed.trigger(SmartViews.uuid);
    this.onDisposed.reset();
  }

  addQueryColor(color: string, query: string) {
    let queriesColors = this.currentState.colors.queries;
    if (!queriesColors) {
      queriesColors = {};
      this.currentState.colors.queries = queriesColors;
    }

    let queriesList = queriesColors[color];
    if (!queriesList) {
      queriesList = new Set();
      queriesColors[color] = queriesList;
    }

    queriesList.add(query);
  }

  clone(view = this.currentState) {
    const clone: SmartView = {
      name: view.name,
      defaultVisibility: view.defaultVisibility,
      visibilityExceptions: {},
      colors: {},
    };

    if (view.colors.items) {
      clone.colors.items = {};
      for (const [style, map] of Object.entries(view.colors.items)) {
        clone.colors.items[style] = OBC.ModelIdMapUtils.clone(map);
      }
    }

    if (view.colors.queries) {
      clone.colors.queries = {};
      for (const [style, names] of Object.entries(view.colors.queries)) {
        const set = new Set<string>();
        for (const name of names) {
          set.add(name);
        }
        clone.colors.queries[style] = set;
      }
    }

    if (view.visibilityExceptions.queries) {
      const queries = new Set<string>();
      for (const name of view.visibilityExceptions.queries) {
        queries.add(name);
      }
      clone.visibilityExceptions.queries = queries;
    }

    if (view.visibilityExceptions.items) {
      clone.visibilityExceptions.items = OBC.ModelIdMapUtils.clone(
        view.visibilityExceptions.items,
      );
    }

    return clone;
  }

  saveCurrnetState(name: string) {
    const smartView = this.clone();
    smartView.name = name;
    const id = OBC.UUID.create();
    this.list.set(id, smartView);
    return { id, smartView };
  }

  async reset() {
    const highlighter = this.components.get(OBF.Highlighter);
    const hider = this.components.get(OBC.Hider);
    const promises = [highlighter.clear(), hider.set(true)];
    await Promise.all(promises);

    this.currentState = {
      name: "SmartView",
      defaultVisibility: true,
      visibilityExceptions: {},
      colors: {},
    };
  }

  async apply(view: SmartView) {
    if (!this.enabled) return;
    const { defaultVisibility, visibilityExceptions, colors } = view;

    const highlighter = this.components.get(OBF.Highlighter);
    const hider = this.components.get(OBC.Hider);
    const finder = this.components.get(OBC.ItemsFinder);

    const promises = [this.reset(), hider.set(defaultVisibility)];

    if (visibilityExceptions.items) {
      promises.push(hider.set(!defaultVisibility, visibilityExceptions.items));
    }

    if (visibilityExceptions.queries) {
      const queryPromises = [];
      for (const name of visibilityExceptions.queries) {
        const finderQuery = finder.list.get(name);
        if (!finderQuery) continue;
        queryPromises.push(finderQuery.test());
      }
      const maps = await Promise.all(queryPromises);
      const map = OBC.ModelIdMapUtils.join(maps);
      promises.push(hider.set(!defaultVisibility, map));
    }

    const colorsMap = new Map<string, OBC.ModelIdMap>();
    const addStyleMap = (color: string, map: OBC.ModelIdMap) => {
      let colorMap = colorsMap.get(color);
      if (!colorMap) {
        colorMap = {};
        colorsMap.set(color, colorMap);
      }
      OBC.ModelIdMapUtils.add(colorMap, map);
    };

    if (colors.queries) {
      for (const [color, queryNames] of Object.entries(colors.queries)) {
        const queryPromises = [];
        for (const name of queryNames) {
          const finderQuery = finder.list.get(name);
          if (!finderQuery) continue;
          queryPromises.push(finderQuery.test());
        }
        const maps = await Promise.all(queryPromises);
        const map = OBC.ModelIdMapUtils.join(maps);
        addStyleMap(color, map);
      }
    }

    if (colors.items) {
      for (const [style, map] of Object.entries(colors.items)) {
        addStyleMap(style, map);
      }
    }

    for (const [color, map] of colorsMap.entries()) {
      if (!highlighter.styles.has(color)) {
        highlighter.styles.set(color, {
          color: new THREE.Color(color),
          renderedFaces: 1,
          opacity: 1,
          transparent: false,
        });
      }
      promises.push(highlighter.highlightByID(color, map));
    }

    await Promise.all(promises);

    this.currentState = this.clone(view);
  }
}

export * from "./src";

