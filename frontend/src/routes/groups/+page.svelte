<script lang="ts">
    import { onMount } from "svelte";
    let groups = [] as any[];
    const backendURL: string = import.meta.env.VITE_BACKEND_URL;
    const list_tokens: string[] = ["token_abc123"];
    onMount(async () => {
        fetch('http://127.0.0.1:4000/groups/token_abc123', {
  method: 'GET',
  credentials: 'include', // include cookies if your backend sets any
  headers: {
    'Content-Type': 'application/json', // important for POST/JSON too
  },
})
  .then(res => {
    if (!res.ok) throw new Error('Request failed');
    return res.json(); // or .text() depending on your response
  })
  .then(data => {
    console.log('Data from backend:', data);
  })
  .catch(err => {
    console.error('Error:', err);
  });

        /*const url = `http://${backendURL}/groups/${list_tokens}`;
        console.log(url);

        const response = await fetch(url, {
            method: "GET",
            credentials: "include", // very important for sending cookies
            headers: {
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const json = await response.json();
        console.log(json);*/
    });
</script>

<main>
    {#each groups as group}{/each}
</main>

<style>
</style>
