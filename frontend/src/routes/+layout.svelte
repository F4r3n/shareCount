<script lang="ts">
  import "../app.css";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { type MenuNavigation, menus } from "$lib/menus";
  import { current_groupStore } from "@stores/group";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { ChevronLeftIcon } from "lucide-svelte";
  let { children } = $props();

  let token_id = $state("");
  let mainfest = $state({ href: "", linkTag: "", useCredentials: false });
  let current_menu: MenuNavigation | undefined = $derived(
    menus.find((menu) => menu.path == page.route.id)
  );
  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    token_id = params.get("id") ?? "";
    if (!import.meta.env.IS_MOBILE) {
      // Only load the PWA code if we are on mobile
      const { initPWA } = await import(/* @vite-ignore */ "../lib/pwa-init");
      initPWA();
    }
  });
  let webManifestLink = $derived(mainfest);
</script>

<svelte:head>
  {#if !import.meta.env.IS_MOBILE}
    <link
      rel="manifest"
      href={webManifestLink.href}
      crossorigin="use-credentials"
    />
  {/if}
</svelte:head>

<header
  class="sticky top-0 z-20 bg-base-100/85 backdrop-blur border-b border-base-300"
>
  <div class="mx-auto max-w-2xl h-14 px-2 flex items-center gap-1">
    {#if current_menu?.return_path}
      <button
        class="btn btn-ghost btn-circle btn-sm"
        aria-label="Back"
        onclick={() => {
          if (current_menu?.return_path)
            goto(resolve(current_menu.return_path));
        }}
      >
        <ChevronLeftIcon size={22} />
      </button>
    {:else}
      <div class="w-3"></div>
    {/if}
    <div class="min-w-0 leading-tight">
      {#if $current_groupStore}
        <div class="text-xs font-medium text-base-content/55">ShareCount</div>
        <div class="font-semibold truncate">{$current_groupStore.name}</div>
      {:else}
        <div class="text-lg font-semibold tracking-tight">ShareCount</div>
      {/if}
    </div>
  </div>

  {#if $current_groupStore && current_menu?.display_tab}
    <div class="mx-auto max-w-2xl px-4 pb-3">
      <div role="tablist" class="tabs tabs-box tabs-sm grid grid-flow-col auto-cols-fr bg-base-200">
        {#each menus as sub (sub.name)}
          {#if sub.display_tab}
            <button
              role="tab"
              class="tab font-medium"
              class:tab-active={page.route.id == sub.path}
              aria-selected={page.route.id == sub.path}
              onclick={() => {
                goto(resolve(`${sub.path}?id=${token_id}`));
              }}
            >
              {sub.name}
            </button>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</header>

{@render children()}
