<script>
  import HeadingRow from './HeadingRow.svelte';
  let { heading, onselect, depth = 0 } = $props();
</script>

{#if heading.children.length > 0}
  <details open>
    <summary>
      <button class="heading-btn" onclick={() => onselect(heading.anchor)}>
        {heading.text}
      </button>
    </summary>
    <ul class="children">
      {#each heading.children as child (child.id)}
        <li>
          <HeadingRow heading={child} {onselect} depth={depth + 1} />
        </li>
      {/each}
    </ul>
  </details>
{:else}
  <button class="heading-btn leaf" onclick={() => onselect(heading.anchor)}>
    {heading.text}
  </button>
{/if}

<style>
  details {
    width: 100%;
  }

  summary {
    list-style: none;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary::before {
    content: '\25B6';
    font-size: 8px;
    color: var(--toc-arrow, #999);
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }

  details[open] > summary::before {
    transform: rotate(90deg);
  }

  .heading-btn {
    background: none;
    border: none;
    padding: 4px 6px;
    font-size: 13px;
    line-height: 1.4;
    color: var(--toc-text, #333);
    cursor: pointer;
    text-align: left;
    border-radius: 4px;
    width: 100%;
    font-family: inherit;
  }

  .heading-btn:hover {
    background: var(--toc-hover, rgba(0, 0, 0, 0.05));
  }

  .children {
    list-style: none;
    padding-left: 16px;
    margin: 0;
  }

  .children li {
    margin: 0;
  }
</style>
