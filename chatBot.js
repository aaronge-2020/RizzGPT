import * as openai from "https://cdn.jsdelivr.net/npm/openai@4.0.1/+esm";


async function check4key(k){
    if(!k){
        const msgTrue = 'API key found, provided to SDK'
        const msgFalse = 'No GPT API Key found, please generate one at https://platform.openai.com/account/api-keys'
        if((localStorage.GPT_API_key)&&(localStorage.GPT_API_key!='null')&&(localStorage.GPT_API_key.length>0)){
            console.log(msgTrue)
        }else{
            console.log(msgFalse)
            localStorage.GPT_API_key=prompt(msgFalse+' and provide it here: ')
        }
        // check that key is valid
        let backupKey = key
        key=localStorage.GPT_API_key
        let res = await completions('say hello')
        if(!res.error){
            console.log('key tested successfuly:',res)
        }else{
            key=backupKey // reinstate previous key
            localStorage.GPT_API_key=key
            console.log(res.error.message)
            localStorage.GPT_API_key=prompt('Unable to validate key. You can generate a new one at please generate one at https://platform.openai.com/account/api-keys. Please try again:')
            check4key()
        }
        // delete localStorage.GPT_API_key // if this machine cannot be trusted with a persistent API key
    }else{
        localStorage.GPT_API_key=k
        check4key()
    }
        
}


async function askChatGpt(message, systemPrompt="You are a helpful assistant", model) {

    check4key();
    const configuration = new openai.Configuration({
      apiKey: localStorage.GPT_API_key, // DO NOT copy-paste your raw API key here!
    });
    const openAIClient = new openai.OpenAIApi(configuration);
    
    const response = await openAIClient.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
            role: 'system',
            content: systemPrompt,
        },
        {
        role: 'user', 
        content: message,
      }]
    });
    
    return response.data.choices[0].message.content;
}

  export{askChatGpt}