async function generateResponses() {
    var fileInput = document.getElementById('fileInput');
    var status = document.getElementById('status');
    var recognizedTextElement = document.getElementById('recognizedText');
    var responseList = document.getElementById('responses');
    responseList.innerHTML = "";
    status.textContent = "Reading the image...";

    if (fileInput.files.length > 0) {
        var file = fileInput.files[0];
        var reader = new FileReader();
        reader.onload = async function (e) {
            Tesseract.recognize(
                e.target.result,
                'eng',
                { logger: m => console.log(m) }
            ).then(async ({ data: { text } }) => {
                recognizedTextElement.textContent = text;
                status.textContent = "Text recognized! Generating responses...";

                // Use GPT SDK to generate responses
                var completions = await jonas.completions(text);
                var responses = completions.choices.map(choice => choice.message.content);

                // Display the responses
                responses.forEach(response => {
                    var listItem = document.createElement('li');
                    listItem.textContent = response;
                    responseList.appendChild(listItem);
                });

                status.textContent = "Responses generated!";
            });
        };
        reader.readAsDataURL(file);
    } else {
        status.textContent = "Please select an image.";
    }
}
