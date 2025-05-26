<script lang="ts">
	import "../app.css";
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";
	import { menus } from "$lib/menus";
    import { current_groupStore } from "../stores/group";
	import { base } from '$app/paths';
	let { children } = $props();

	let token_id = $state("");
	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		token_id = params.get("id") ?? "";
	});
	let drawerState = $state(false);
</script>

<div class="drawer">
	<input
		id="my-drawer-3"
		type="checkbox"
		class="drawer-toggle"
		bind:checked={drawerState}
	/>
	<div class="drawer-content flex flex-col">
		<!-- Navbar -->
		<div class="navbar bg-base-300 w-full banner">
			<div class="flex-none lg:hidden">
				<label
					for="my-drawer-3"
					aria-label="open sidebar"
					class="btn btn-square btn-ghost"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="inline-block h-6 w-6 stroke-current"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						></path>
					</svg>
				</label>
			</div>
			<div class="mx-2 flex-1 px-2 lg:text-2xl md:text-xl sm:text-lg">
				<button
					class="hover:cursor-pointer"
					onclick={() => {
						goto(base + '/');
					}}
				>
					{`ShareCount${$current_groupStore !== null ? ": " + $current_groupStore.name : ""}`}
				</button>
			</div>
			<div class="hidden flex-none lg:block">
				<ul
					class="menu menu-horizontal lg:text-2xl md:text-xl sm:text-lg"
				>
					{#each menus as sub (sub.name)}
						{#if sub.need_group && $current_groupStore}
							<li>
								<button
									class="cursor-pointer"
									onclick={() => {
										goto(base + `${sub.path}?id=${token_id}`);
										drawerState = false;
									}}
								>
									{sub.name}
								</button>
							</li>
						{/if}
					{/each}
				</ul>
			</div>
		</div>
		{@render children()}
	</div>
	<div class="drawer-side">
		<label
			for="my-drawer-3"
			aria-label="close sidebar"
			class="drawer-overlay"
		></label>
		<ul class="menu bg-base-200 min-h-full w-80 p-4">
			<!-- Sidebar content here -->
			{#each menus as sub (sub.name)}
				{#if !sub.need_group || (sub.need_group && $current_groupStore)}
					<li>
						<button
							class="cursor-pointer"
							onclick={() => {
								goto(base + `${sub.path}?id=${token_id}`);
								drawerState = false;
							}}
						>
							{sub.name}
						</button>
					</li>
				{/if}
			{/each}
		</ul>
	</div>
</div>

<style>
	.banner {
		background-color: var(--color-primary);
		color: var(--color-primary-content);
	}
</style>
