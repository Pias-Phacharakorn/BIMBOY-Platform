# BUI Web Component Patterns (v3.4.x)

`@thatopen/ui` (BUI) uses Web Components. They integrate seamlessly alongside React, but they use different paradigms.

## Creating Components
Use `BUI.StatefullComponent` to define a component factory. Return a template using `BUI.html`.

```typescript
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";

export interface MyPanelState {
  components: OBC.Components;
  title: string;
}

export const myPanelTemplate: BUI.StatefullComponent<MyPanelState> = (state) => {
  return BUI.html`
    <bim-panel-section label=${state.title}>
      <bim-label>Content goes here</bim-label>
    </bim-panel-section>
  `;
};
```

## Instantiating Components
When a component uses `BUI.html`, instantiate nested components or templates using `BUI.Component.create`.

```typescript
const [childComponent] = BUI.Component.create(myPanelTemplate, { 
    components, 
    title: "Dynamic Title" 
});

// Inject into another template
return BUI.html`
    <div>
        ${childComponent}
    </div>
`;
```

## Event Binding
Bind native DOM events using the `@` syntax.

```typescript
const onSearch = (e: Event) => {
  const input = e.target as BUI.TextInput;
  console.log("Searching for:", input.value);
};

return BUI.html`
  <bim-text-input @input=${onSearch} placeholder="Search..."></bim-text-input>
`;
```
