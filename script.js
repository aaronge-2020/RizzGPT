// Utility function to extract average color from an image
function extractAverageColor(imageData) {
  const { data } = imageData;
  let R = 0,
    G = 0,
    B = 0;

  for (let i = 0; i < data.length; i += 4) {
    R += data[i];
    G += data[i + 1];
    B += data[i + 2];
  }

  const numPixels = data.length / 4;
  return [R / numPixels, G / numPixels, B / numPixels];
}

// Utility function to perform k-means clustering on colors
function clusterColors(colors) {
  // Initialize two cluster centers randomly (you could also use specific seeds)
  let cluster1 = colors[0];
  let cluster2 = colors[Math.floor(colors.length / 2)];

  // Iterate until convergence
  for (let iteration = 0; iteration < 10; iteration++) {
    const sum1 = [0, 0, 0],
      sum2 = [0, 0, 0];
    let count1 = 0,
      count2 = 0;

    // Assign colors to clusters
    for (const color of colors) {
      const dist1 = Math.sqrt(
        (color[0] - cluster1[0]) ** 2 +
          (color[1] - cluster1[1]) ** 2 +
          (color[2] - cluster1[2]) ** 2
      );
      const dist2 = Math.sqrt(
        (color[0] - cluster2[0]) ** 2 +
          (color[1] - cluster2[1]) ** 2 +
          (color[2] - cluster2[2]) ** 2
      );

      if (dist1 < dist2) {
        sum1[0] += color[0];
        sum1[1] += color[1];
        sum1[2] += color[2];
        count1++;
      } else {
        sum2[0] += color[0];
        sum2[1] += color[1];
        sum2[2] += color[2];
        count2++;
      }
    }

    // Update cluster centers
    cluster1 = [sum1[0] / count1, sum1[1] / count1, sum1[2] / count1];
    cluster2 = [sum2[0] / count2, sum2[1] / count2, sum2[2] / count2];
  }

  return [cluster1, cluster2];
}

// Utility function to classify a bubble's role based on its color and clusters
function classifyBubbleRole(imageData, clusters) {
  const color = extractAverageColor(imageData);
  const dist1 = Math.sqrt(
    (color[0] - clusters[0][0]) ** 2 +
      (color[1] - clusters[0][1]) ** 2 +
      (color[2] - clusters[0][2]) ** 2
  );
  const dist2 = Math.sqrt(
    (color[0] - clusters[1][0]) ** 2 +
      (color[1] - clusters[1][1]) ** 2 +
      (color[2] - clusters[1][2]) ** 2
  );

  // Classify based on distance to cluster centers
  return dist1 < dist2 ? "Receiver" : "Sender"; // Adjust based on your data
}

async function proceedToTranscript() {

  const fileInput = document.getElementById("fileInput");
  const status = document.getElementById("status");
  const recognizedTextElement = document.getElementById("recognizedText");
  const responseList = document.getElementById("responses");

  responseList.innerHTML = "";
  status.textContent = "Reading the image...";

  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async function (e) {
      const img = new Image();
      img.src = e.target.result;

      //   Set the uploaded image source
      document.getElementById("uploadedImage").src = e.target.result;
      document.getElementById("uploadedImage").style.display = "block";

      img.onload = async function () {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const speechBubbles = await getSpeechBubbles(canvas, ctx);
        const colors = speechBubbles.map((bubble) =>
          extractAverageColor(bubble.colorImageData)
        );
        const clusters = clusterColors(colors);

        const recognizedTexts = [];
        for (let { bubbleCanvas, colorImageData } of speechBubbles) {
          const role = classifyBubbleRole(colorImageData, clusters);
          const {
            data: { text },
          } = await Tesseract.recognize(bubbleCanvas);
          recognizedTexts.push({ role, text });
        }

        const fullText = recognizedTexts
          .map(({ role, text }) => `${role}: ${text}`)
          .join("\n");
        const prompt = `I have a text message conversation that's marred by typos, extraneous characters, symbols, and other inconsistencies. Can you please revise the following transcript to make it more coherent and free of errors? Here is the transcript:
            ${fullText}
            `;

        const response = await askChatGpt(prompt, "You are a helpful assistant", "gpt-3.5-turbo", 0, 0);

        recognizedTextElement.value = response;

        status.textContent =
          "Text recognized! Please confirm or edit the transcript.";

        // Move to the next carousel item
      };
    };
    reader.readAsDataURL(file);
  } else {
    status.textContent = "Please select an image.";
  }
}

async function proceedToResponses() {
  const GPT = await import("https://episphere.github.io/gpt/jonas/export.js");

  const status = document.getElementById("status");
  const recognizedTextElement = document.getElementById("recognizedText");
  const responseList = document.getElementById("responses");
  status.textContent = "Generating responses...";

  const fullText = recognizedTextElement.value; // Get the edited transcript

  // Use GPT SDK to generate responses
  // Your GPT call code here, using the fullText variable
  // ...

  const response = await askChatGpt(`My friend is looking for advice on how to respond to the girl's last message. Please suggest 5 unique and playful responses my friend could send that continue the dialogue. 
  Ensure the responses are friendly, interesting, and respectful. Keep the responses brief and don't use emojis. My friend is the receiver in the conversation. The conversation so far is as follows:

“””
${fullText}
“””

tone: conversational, playful, spartan`);
  const responseText = document.createElement("pre");
  responseText.textContent = response;
  responseList.appendChild(responseText);

  // Move to the next carousel item
  $("#transcriptCarousel").carousel("next");
  status.textContent = "Responses generated!";
}

async function getSpeechBubbles(canvas, ctx) {
  // Parameters
  const exclude_percentage = 10;
  const exclude_percentage_bottom_adjusted = 12;
  const size_threshold_latest_updated = 2000;
  const min_contour_height = 30; // Minimum height requirement for the contours

  // Convert the image to a format suitable for OpenCV
  const image_cv = cv.imread(canvas);
  const image_gray = new cv.Mat();
  cv.cvtColor(image_cv, image_gray, cv.COLOR_BGR2GRAY);

  // Apply adaptive thresholding
  const thresholded = new cv.Mat();
  cv.adaptiveThreshold(
    image_gray,
    thresholded,
    255,
    cv.ADAPTIVE_THRESH_MEAN_C,
    cv.THRESH_BINARY_INV,
    11,
    2
  );

  // Apply morphological operations
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  const processed = new cv.Mat();
  cv.morphologyEx(thresholded, processed, cv.MORPH_CLOSE, kernel);

  // Find contours
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    processed,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE
  );

  // Determine the height limits with adjusted bottom exclusion
  const height_limit_top = (image_gray.rows * exclude_percentage) / 100;
  const height_limit_bottom =
    image_gray.rows * (1 - exclude_percentage_bottom_adjusted / 100);

  // Create a list of images for each speech bubble, with adjusted filtering
  const speechBubbles = [];
  for (let i = contours.size() - 1; i >= 0; i--) {
    const contour = contours.get(i);
    const rect = cv.boundingRect(contour);
    if (
      rect.y > height_limit_top &&
      rect.y + rect.height < height_limit_bottom &&
      cv.contourArea(contour) > size_threshold_latest_updated &&
      rect.height > min_contour_height
    ) {
      const bubble = image_gray.roi(rect);
      const colorBubble = ctx.getImageData(
        rect.x,
        rect.y,
        rect.width,
        rect.height
      );

      // Preprocessing to enhance text recognition
      cv.resize(bubble, bubble, new cv.Size(bubble.cols * 2, bubble.rows * 2)); // Resize to make text larger
      cv.threshold(bubble, bubble, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU); // Apply binary thresholding
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, 1));
      cv.morphologyEx(bubble, bubble, cv.MORPH_CLOSE, kernel); // Apply morphological closing to reduce noise

      // Create a new canvas element to draw the speech bubble
      const bubbleCanvas = document.createElement("canvas");
      bubbleCanvas.width = rect.width;
      bubbleCanvas.height = rect.height;
      const bubbleCtx = bubbleCanvas.getContext("2d");
      const bubbleImageData = bubbleCtx.createImageData(
        rect.width,
        rect.height
      );
      bubble.data.forEach(
        (value, index) => (bubbleImageData.data[index] = value)
      );
      bubbleCtx.putImageData(bubbleImageData, 0, 0);

      // Set a temporary ID for the canvas
      bubbleCanvas.id = "tempCanvasOutput" + i;
      // Append the canvas to an off-screen container (not visible to the user)
      const offScreenContainer = document.createElement("div");
      offScreenContainer.style.display = "none";
      offScreenContainer.appendChild(bubbleCanvas);
      document.body.appendChild(offScreenContainer);

      // Use the temporary ID with cv.imshow
      cv.imshow(bubbleCanvas.id, bubble);

      // Remove the off-screen container after processing
      document.body.removeChild(offScreenContainer);

      speechBubbles.push({ bubbleCanvas, colorImageData: colorBubble });
    }
  }

  // Clean up resources
  image_cv.delete();
  image_gray.delete();
  thresholded.delete();
  kernel.delete();
  processed.delete();
  contours.delete();
  hierarchy.delete();

  return speechBubbles;
}

var key = null //'null'

async function check4key(k) {

  const openai = await import("https://cdn.skypack.dev/openai");


  if (!k) {
    const msgTrue = "API key found, provided to SDK";
    const msgFalse =
      "No GPT API Key found, please generate one at https://platform.openai.com/account/api-keys";
    if (
      localStorage.GPT_API_key &&
      localStorage.GPT_API_key != "null" &&
      localStorage.GPT_API_key.length > 0
    ) {
      console.log(msgTrue);
    } else {
      console.log(msgFalse);
      localStorage.GPT_API_key = prompt(msgFalse + " and provide it here: ");
    }
    // check that key is valid
    let backupKey = key;
    key = localStorage.GPT_API_key;
    let res = await completions("say hello");
    if (!res.error) {
      console.log("key tested successfuly:", res);
    } else {
      key = backupKey; // reinstate previous key
      localStorage.GPT_API_key = key;
      console.log(res.error.message);
      localStorage.GPT_API_key = prompt(
        "Unable to validate key. You can generate a new one at please generate one at https://platform.openai.com/account/api-keys. Please try again:"
      );
      check4key();
    }
    // delete localStorage.GPT_API_key // if this machine cannot be trusted with a persistent API key
  } else {
    localStorage.GPT_API_key = k;
    check4key();
  }
}

async function askChatGpt(
  message,
  systemPrompt = `You are a confident and charismatic man who is known to be exceptionally good with women. You don't use emojis and you don't say things that sound corny and cheesy.`,
  model = "gpt-3.5-turbo", 
  temperature = 0,
  presence_penalty = 0.7,
) {
  const openai = await import("https://cdn.skypack.dev/openai");
  
  const openAIClient = new openai.OpenAI({
    apiKey: localStorage.GPT_API_key, // DO NOT copy-paste your raw API key here!
    dangerouslyAllowBrowser: true,
  });
  

  const response = await openAIClient.chat.completions.create({
    model: model,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: message,
      },
    ],
    temperature: parseFloat(temperature),
    presence_penalty: parseFloat(presence_penalty),
  });

  return response.choices[0].message.content;
}

//async function completions(content='Say this is a test!',model='gpt-3.5-turbo',role='user',temperature=0.7){
  async function completions(content='Say this is a test!',model='gpt-3.5-turbo-16k-0613',role='user',temperature=0,functionsImport){
    if(!model){
        model='gpt-3.5-turbo-16k-0613'
    }
    if(!role){
        role='user'
    }
    if(!temperature){
        temperature=0.7
    }

    let functionCall={}
    let obj = {
        model:model,
        messages:[
            {
                role:role,
                content:content
            }
        ],
        temperature:parseFloat(temperature),
    }
    if((obj.messages.length==1)&(obj.messages[0].content[0]=='[')){ //parse array if bassed back stringified
        obj.messages=JSON.parse(obj.messages[0].content)
    }
    if(functionsImport){ // functions being checked
        obj.functions=[]
        let funs = await import(functionsImport)
        Object.keys(funs).forEach(k=>{
            if(typeof(funs[k])=='object'){
                obj.functions.push(funs[k])
            }else{
                functionCall[k]=funs[k]
            }
        }) 
        //debugger
    }
    console.log('obj',obj)
    //return await 
    let res = await
        (await fetch(`https://api.openai.com/v1/chat/completions`,
             {
                 method:'POST',
                 headers:{
                     'Authorization':`Bearer ${key}`,
                     'Content-Type': 'application/json',
                 },
                 body:JSON.stringify(obj)
             })
         ).json()
    functionCall
    res.choices.forEach(c=>{
        if(c.finish_reason=='function_call'){
            functionCall[c.message.function_call.name](JSON.parse(c.message.function_call.arguments))
            //debugger
        }
    })
    //debugger
    return res
}

check4key();