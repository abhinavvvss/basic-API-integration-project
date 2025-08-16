let chatBox = document.getElementById("chat-box");
let userInput = document.getElementById("user-input");
let themeToggle = document.getElementById("theme-toggle");
let exportPdfButton = document.getElementById("export-pdf");
let chatHistory = [];
let isTyping = false;

// Load theme preference from local storage
const currentTheme = localStorage.getItem('theme');
if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
    document.querySelector('.chat-container').classList.add('dark-mode');
    document.querySelectorAll('.header, #chat-box, .input-area, .loan-options, .export-area').forEach(el => el.classList.add('dark-mode'));
    themeToggle.textContent = '🌞';
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    document.querySelector('.chat-container').classList.toggle('dark-mode');
    document.querySelectorAll('.header, #chat-box, .input-area, .loan-options, .export-area').forEach(el => el.classList.toggle('dark-mode'));

    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        themeToggle.textContent = '🌞';
    } else {
        localStorage.setItem('theme', 'light');
        localStorage.setItem('theme', 'light'); // Corrected typo
        themeToggle.textContent = '🌙';
    }
});

function addMessage(sender, text, isTyping = false) {
    const msg = document.createElement("div");
    msg.classList.add("message", sender);
    if (isTyping) {
        msg.classList.add("typing-indicator");
        msg.innerText = "Typing...";
    } else {
        msg.innerText = text;
    }
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function handleUserInput() {
    const input = userInput.value.trim();
    if (!input) return;

    addMessage("user", input);
    chatHistory.push({ role: "user", parts: [{ text: input }] }); // Gemini format
    userInput.value = "";

    addMessage("bot", "", true); // Show typing indicator
    isTyping = true;

    const aiReply = await fetchGeminiResponse(chatHistory);
    chatBox.lastChild.remove(); // Remove typing indicator
    addMessage("bot", aiReply);
    chatHistory.push({ role: "model", parts: [{ text: aiReply }] }); // Gemini format
    isTyping = false;
}

function handlePredefinedOption(option) {
    const message = `Tell me more about ${option}.`;
    addMessage("user", message);
    chatHistory.push({ role: "user", parts: [{ text: message }] }); // Gemini format

    addMessage("bot", "", true); // Show typing indicator
    isTyping = true;

    fetchGeminiResponse(chatHistory)
        .then(aiReply => {
            chatBox.lastChild.remove(); // Remove typing indicator
            addMessage("bot", aiReply);
            chatHistory.push({ role: "model", parts: [{ text: aiReply }] }); // Gemini format
            isTyping = false;
        })
        .catch(error => {
            chatBox.lastChild.remove(); // Remove typing indicator
            addMessage("bot", "Sorry, I encountered an error.");
            console.error("Error fetching Gemini response:", error);
            isTyping = false;
        });
}

async function fetchGeminiResponse(messages) {
    const apiKey = "AIzaSyD5k-8W5ZTpKQiK3sAN684LQ7tgZSShiss";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const formattedMessages = messages.map(msg => ({ // Define formattedMessages here
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: msg.parts,
    }));

    const initialPrompt = `You are a helpful loan assistant. You help users calculate and understand loans. You can remember previous questions and context. If the user asks to calculate a loan, ask for the principal amount, interest rate (as a percentage), and loan term (in years) if not already provided. If the user provides these details, calculate the monthly payment using the formula: M = P [ i(1 + i)^n ] / [ (1 + i)^n – 1 ], where M is the monthly payment, P is the principal loan amount, i is the monthly interest rate (annual rate divided by 12 and then by 100), and n is the total number of payments (loan term in years multiplied by 12). Also, ask about potential loan fees like processing fees or prepayment penalties.\n\n`;

    const geminiContents = formattedMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: msg.parts,
    }));

    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [{ text: initialPrompt + (geminiContents.length > 0 ? geminiContents[0].parts[0].text : "") }]
            },
            ...geminiContents.slice(1)
        ]
    };

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        console.log("Gemini response:", data);

        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
            return typeWriterEffect(data.candidates[0].content.parts[0].text.trim());
        } else if (data.error) {
            return "Error: " + data.error.message;
        } else {
            return "Sorry, something went wrong with the Gemini API.";
        }
    } catch (error) {
        console.error("Error fetching from Gemini API:", error);
        return "Sorry, there was a network error.";
    }
}

function calculateMonthlyPayment(principal, annualInterestRate, years, processingFee = 0, prepaymentPenalty = 0) {
    const monthlyInterestRate = annualInterestRate / 100 / 12;
    const numberOfPayments = years * 12;

    if (monthlyInterestRate === 0) {
        return (principal + processingFee + prepaymentPenalty) / numberOfPayments;
    }

    const monthlyPayment = (principal * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) / (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1) + (processingFee / numberOfPayments) + (prepaymentPenalty / numberOfPayments);
    return monthlyPayment.toFixed(2);
}

function typeWriterEffect(text, speed = 30) {
    return new Promise((resolve) => {
        let i = 0;
        const typingInterval = setInterval(() => {
            if (i < text.length) {
                chatBox.lastChild.textContent += text.charAt(i);
                chatBox.scrollTop = chatBox.scrollHeight;
                i++;
            } else {
                clearInterval(typingInterval);
                resolve(text);
            }
        }, speed);
    });
}

exportPdfButton.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const chatMessages = document.querySelectorAll('#chat-box .message');
    let y = 20;
    const lineHeight = 10;
    const margin = 15;

    pdf.setFontSize(12);

    chatMessages.forEach(msg => {
        const text = msg.innerText;
        const sender = msg.classList.contains('user') ? 'User:' : 'Bot:';
        const fullText = `${sender} ${text}`;
        const textLines = pdf.splitTextToSize(fullText, pdf.internal.pageSize.width - 2 * margin);
        textLines.forEach(line => {
            if (y + lineHeight > pdf.internal.pageSize.height - margin) {
                pdf.addPage();
                y = margin;
            }
            pdf.text(margin, y, line);
            y += lineHeight;
        });
        y += 5; // Add some space between messages
    });

    pdf.save('loan_chat.pdf');
});