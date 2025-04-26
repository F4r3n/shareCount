<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    interface Group {
        name: string;
        currency: string;
        created_at: Date;
        token: string;
    }
    let groups = $state([] as Group[]);
    const backendURL: string = import.meta.env.VITE_BACKEND_URL;
    let list_tokens: string[] = ["token_abc123"];
    let is_connected: boolean = false;
    onMount(async () => {
        let list_tokens_string;

        if (is_connected) {
            //get list groups
        } else {
            list_tokens_string = localStorage.getItem("list_tokens");
            if (list_tokens_string) {
                list_tokens = JSON.parse(list_tokens_string);
            }
            groups = [];
            for(const token of list_tokens)
            {
                
                fetch(`http://127.0.0.1:4000/groups/${token}`, {
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
                    data = data[0];
                    let group = {
                        name: data.name,
                        currency: data.currency,
                        created_at: new Date(data.created_at),
                        token:token
                    };
                    

                    console.log(group)

                    groups.push(group);
                })
                .catch((err) => {
                    console.error("Error:", err);
                });
            }

        }
    });
</script>

<main>
    {#each groups as group}
        <button
            type="button"
            class="group btn btn-neutral"
            onclick={() => {
                goto(`/group?id=${group.token}`);
            }}
        >
            <div class="text-2xl font-bold group-title">{group.name}</div>
            <div class="text-sm pt-2 group-date">
                {group.created_at.toLocaleDateString()}
            </div>
        </button>
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
        border-color: var(--color-accent);
        padding: 30px;
    }
</style>
