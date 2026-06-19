import * as OBC from "@thatopen/components";

export const setupItemsFinder = (components: OBC.Components) => {
  const finder = components.get(OBC.ItemsFinder);

  //Category Search
  finder.create("Walls", [
    { categories: [/WALL/] }
  ]);

  finder.create("Doors", [
    { categories: [/DOOR/] }
  ]);

  finder.create("Windows", [
    { categories: [/WINDOW/] }
  ]);

  // Level Based Column Search
  finder.create("Column at level +0.20_FLOOR_LEVEL1", [
    {
      categories: [/COLUMN/],
      relation: {
        name: "ContainedInStructure",
        query: {
          attributes: {
            queries: [{ name: /Name/, value: /\+0\.20_FLOOR_LEVEL1/ }]
          }
        }
      }
    }
  ]);

  finder.create("Column at level +3.60_FLOOR_LEVEL2", [
    {
      categories: [/COLUMN/],
      relation: {
        name: "ContainedInStructure",
        query: {
          attributes: {
            queries: [{ name: /Name/, value: /\+3\.60_FLOOR_LEVEL2/ }]
          }
        }
      }
    }
  ]);
};
