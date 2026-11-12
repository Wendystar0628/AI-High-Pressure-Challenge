// All application dialogs stay inside their owning desktop and never block other systems.
export function createDialogs({ desktop, annotate, icon }) {
  return function dialog(
    s,
    {
      title,
      message = "",
      value,
      choices = [
        ["cancel", "取消"],
        ["ok", "确定"],
      ],
      validate,
    } = {},
  ) {
    return new Promise((resolve) => {
      let previous = document.activeElement,
        root = desktop(s),
        layer = document.createElement("div");
      layer.className = "dialog-layer";
      layer.dataset.testid = "app-dialog";
      layer.dataset.systemId = s.id;
      let card = document.createElement("form");
      card.className = "dialog-card";
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-modal", "true");
      card.setAttribute("aria-label", title);
      let h = document.createElement("h2");
      h.textContent = title;
      card.append(h);
      let p = document.createElement("p");
      p.textContent = message;
      card.append(p);
      let input;
      if (value !== undefined) {
        input = document.createElement("input");
        input.value = value;
        input.dataset.testid = "dialog-input";
        input.setAttribute("aria-label", title);
        card.append(input);
      }
      let error = document.createElement("div");
      error.className = "dialog-error";
      error.setAttribute("role", "alert");
      card.append(error);
      let footer = document.createElement("footer");
      for (let [id, label] of choices) {
        let b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.dataset.testid = "dialog-" + id;
        if (id === "ok" || id === "save") b.className = "primary";
        b.onclick = () => finish(id);
        footer.append(b);
      }
      card.append(footer);
      layer.append(card);
      root.append(layer);
      annotate(layer, s);
      function finish(id) {
        let result = input?.value.trim();
        if (id === "ok" && input) {
          try {
            if (!result) throw Error("请输入内容");
            validate?.(result);
          } catch (e) {
            error.textContent = e.message;
            input.focus();
            return;
          }
        }
        layer.remove();
        previous?.isConnected && previous.focus();
        resolve(input ? (id === "ok" ? result : null) : id);
      }
      card.onsubmit = (e) => {
        e.preventDefault();
        finish(choices.some((c) => c[0] === "ok") ? "ok" : choices[0][0]);
      };
      layer.onpointerdown = (e) => e.stopPropagation();
      layer.onkeydown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish("cancel");
        }
        if (e.key === "Tab") {
          let nodes = [...card.querySelectorAll("input,button")],
            index = nodes.indexOf(document.activeElement);
          if (
            (e.shiftKey && index === 0) ||
            (!e.shiftKey && index === nodes.length - 1)
          ) {
            e.preventDefault();
            nodes[e.shiftKey ? nodes.length - 1 : 0].focus();
          }
        }
      };
      (
        input ||
        footer.querySelector("button.primary") ||
        footer.firstChild
      ).focus();
      input?.select();
    });
  };
}
