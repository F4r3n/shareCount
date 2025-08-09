<script lang="ts">
  import "../app.css";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { menus } from "$lib/menus";
  import { current_groupStore } from "@stores/group";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  let { children } = $props();

  let token_id = $state("");
  let mainfest = $state({ href: "", linkTag: "", useCredentials: false });
  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    token_id = params.get("id") ?? "";
    console.log(import.meta.env.IS_MOBILE);

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

<div class="top">
  <div class="navbar bg-neutral text-neutral-content banner">
    {#if page.route.id != "/"}
      <button
        class="banner-arrow"
        aria-label="Go to main page"
        onclick={() => goto(base + "/")}
        style="background: none; border: none; padding: 0; margin-right: 1rem; cursor: pointer;"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
    {/if}
    <div class="text-xl">
      {`ShareCount${$current_groupStore !== null ? ": " + $current_groupStore.name : ""}`}
    </div>
  </div>
</div>

{#if $current_groupStore}
  <div role="tablist" class="tabs tabs-border justify-center">
    {#each menus as sub (sub.name)}
      {#if sub.need_group && $current_groupStore}
        <button
          role="tab"
          class="tab text-base md:text-lg lg:text-lg"
          class:tab-active={page.route.id == sub.path}
          onclick={() => {
            goto(base + `${sub.path}?id=${token_id}`);
          }}
        >
          {sub.name}
        </button>
      {/if}
    {/each}
  </div>
{/if}

{@render children()}

<style>
  .banner-arrow {
    display: inline-flex;
    align-items: center;
    height: 100%;
    color: var(--color-primary-content);
  }
  .top {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .banner {
    background-color: var(--color-primary);
    color: var(--color-primary-content);
  }
</style>
