<script lang="ts">
    import { onMount } from "svelte";
    interface Group {
        name: string;
        currency: string;
        created_at: number;
    }
    let groups = $state([] as Group[]);
    const backendURL: string = import.meta.env.VITE_BACKEND_URL;
    let list_tokens: string[] = ["token_abc123"];
    onMount(async () => {
        const list_tokens_string = localStorage.getItem("list_tokens");
        if (list_tokens_string) {
            list_tokens = JSON.parse(list_tokens_string);
        }
        fetch("http://127.0.0.1:4000/groups/token_abc123", {
            method: "GET",
            credentials: "include", // include cookies if your backend sets any
            headers: {
                "Content-Type": "application/json", // important for POST/JSON too
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error("Request failed");
                return res.json(); // or .text() depending on your response
            })
            .then((data) => {
                groups = data as Group[];
            })
            .catch((err) => {
                console.error("Error:", err);
            });
    });
</script>

<main>
    {#each groups as group}
        <div class="group">
            <div class="text-2xl font-bold group-title">{group.name}</div>
            <div class="text-sm pt-2 group-date">{group.created_at}</div>
        </div>
    {/each}
</main>

<style>
    main {
        display: flex;
        width: 100%;
        display: flex;
        justify-content: center;
    }

    .group {
        border-width: 2px;
        border-radius: 10px;
        border-color: #2eafeb;
        background-color: #222222;
        color: #fafafa;
        padding: max(1%, 5px);
        padding-left: max(5%, 5px);
        padding-right: max(5%, 5px);
        margin-top: 5px;
        display: grid;
        min-width: min(400px,50%);
        grid-template-columns: repeat(2, 1em);
    }

    .group-title {
        grid-column: 1 / 5;
        grid-row: 1;
    }

    .group-date {
        grid-column: 4;
        grid-row: 2;
    }
</style>
