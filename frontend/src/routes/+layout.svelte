<script lang="ts">
  import "../app.css";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { menus } from "$lib/menus";
  import { current_groupStore } from "@stores/group";
  import { base } from "$app/paths";
  import { pwaInfo } from "virtual:pwa-info";
  import { useRegisterSW } from "virtual:pwa-register/svelte";
  import { page } from "$app/state";
  let { children } = $props();

  let token_id = $state("");
  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    token_id = params.get("id") ?? "";
    useRegisterSW();
  });
  let webManifestLink = $derived(
    pwaInfo
      ? pwaInfo.webManifest
      : { href: "", linkTag: "", useCredentials: false }
  );
</script>

<svelte:head>
  <link
    rel="manifest"
    href={webManifestLink.href}
    crossorigin="use-credentials"
  />
</svelte:head>

<div class="navbar bg-neutral text-neutral-content banner">
  <div class="text-xl">
    {`ShareCount${$current_groupStore !== null ? ": " + $current_groupStore.name : ""}`}
  </div>
</div>

{#if $current_groupStore}
  <div role="tablist" class="tabs tabs-border justify-center">
    {#each menus as sub (sub.name)}
      {#if !sub.need_group || (sub.need_group && $current_groupStore)}
        <button
          role="tab"
          class="tab text-base md:text-lg lg:text-lg"
          class:tab-active={page.route.id == sub.path}
          onclick={() => {
            goto(base + `${sub.path}?id=${token_id}`);
            drawerState = false;
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
  .banner {
    background-color: var(--color-primary);
    color: var(--color-primary-content);
  }
</style>
