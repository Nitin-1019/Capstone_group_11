(() => { 
    function getActiveText(containerId) { 
        const container = document.getElementById(containerId); 
        
        const button = container?.querySelector( 
            'button[aria-pressed="true"]' 
        ); 
        
        return button?.textContent.trim() || "Not specified"; 
    } 
    
    function copyForReport(element) { 
        let copy = element.cloneNode(true); 
        
        // Preserve the current checkbox/radio selections. 
        const originalInputs = element.querySelectorAll("input"); 
        const copiedInputs = copy.querySelectorAll("input"); 
        
        originalInputs.forEach((input, index) => { 
            if (!copiedInputs[index]) return; 
            
            copiedInputs[index].checked = input.checked; 
            
            if (input.checked) { 
                copiedInputs[index].setAttribute("checked", ""); 
            } else { 
                copiedInputs[index].removeAttribute("checked"); 
            } 
        }); 
        
        // Convert canvas charts into images for PDF printing. 
        const originalCanvases = element.matches("canvas") 
        ? [element] 
        : [...element.querySelectorAll("canvas")]; 
        
        const copiedCanvases = copy.matches("canvas") 
        ? [copy] 
        : [...copy.querySelectorAll("canvas")]; 
        
        originalCanvases.forEach((canvas, index) => { 
            try { 
                const image = document.createElement("img"); 
                image.src = canvas.toDataURL("image/png"); 
                image.alt = "Wellbeing chart"; 
                image.style.width = "100%"; 
                image.style.height = "auto"; 
                
                if (copiedCanvases[index] === copy) { 
                    copy = image; 
                } else { 
                    copiedCanvases[index]?.replaceWith(image); 
                } 
            } catch (error) { 
                console.warn("Could not copy chart:", error); 
            } 
        }); 
        return copy; 
    } 
    
    function addSection(report, heading, element) { 
        const section = document.createElement("section"); 
        section.className = "pdf-report-section"; 
        
        const title = document.createElement("h2"); 
        title.textContent = heading; 
        section.appendChild(title); 
        
        section.appendChild(copyForReport(element)); 
        report.appendChild(section); 
    } 
    
    async function downloadReport() { 
        
        const button = document.getElementById("downloadPdfBtn"); 
        const chart = document.getElementById("stackedChart"); 
        
        if (!chart || !window.Plotly) { 
            alert("Chart is not ready."); 
            return; 
        } 
        
        if (button) { 
            button.disabled = true; 
            button.textContent = "Preparing PDF..."; 
        } 
        try { 
            // Convert the current Plotly chart into a static image. 
            const chartImage = await Plotly.toImage(chart, { 
                format: "png", 
                width: 1100, 
                height: 680, 
                scale: 2 }); 
                
                // Remove any previous report. 
                document.getElementById("pdf-report")?.remove(); 
                
                const report = document.createElement("article"); 
                report.id = "pdf-report"; 
                
                function addText(parent, tag, content, className = "") { 
                    const element = document.createElement(tag); 
                    element.textContent = content; 
                    if (className) element.className = className; 
                    parent.appendChild(element); return element; 
                } 
                
                function currentText(id) { 
                    return document.getElementById(id) 
                        ?.textContent.trim() || ""; 
                    } 
                    
                function activeText(id) { 
                    const button = document.getElementById(id) 
                        ?.querySelector('[aria-pressed="true"]'); 
                        return button?.textContent.trim() || ""; 
                    } 
                        
                    // REPORT HEADER 
                    const header = document.createElement("header"); 
                    header.className = "pdf-report-header"; 
                    
                    addText(header, "h1", "Student Wellbeing Report"); 
                    
                    addText( header, "p", `${activeText("domainButtons")} 
                        — ${activeText("indicatorButtons")}` 
                    ); 
                    addText( header, "p", `Generated: ${new Date().toLocaleString("en-AU")}` 
                ); 
                
                report.appendChild(header); 
                
                // CHART SECTION 
                const chartSection = document.createElement("section"); 
                chartSection.className = 
                "pdf-report-section pdf-chart-section"; 
                
                addText( 
                    chartSection, 
                    "h2", 
                    currentText("distributionTitle") || "Chart" 
                ); 
                
                const description = currentText("distributionDescription"); 
                
                if (description) { 
                    addText(chartSection, "p", description); 
                } 
                
                const image = document.createElement("img"); 
                image.src = chartImage; 
                image.alt = "Student wellbeing chart"; 
                image.className = "pdf-chart-image"; 
                chartSection.appendChild(image); 
                report.appendChild(chartSection); 
                
                // KEY INSIGHT 
                const insight = currentText("distributionSummary"); 
                if (insight) { 
                    const insightSection = document.createElement("section"); 
                    insightSection.className = "pdf-report-section"; 
                    
                    addText(insightSection, "h2", "Key Insight"); 
                    addText(insightSection, "p", insight); 
                    
                    report.appendChild(insightSection); } 
                    
                    // SUMMARY 
                    const summary = currentText("summaryText"); 
                    if (summary) { const summarySection = document.createElement("section"); 
                        summarySection.className = "pdf-report-section"; 
                        
                        addText(summarySection, "h2", "Summary"); 
                        addText(summarySection, "p", summary); 
                        report.appendChild(summarySection); } 
                        
                        // Add the report to the document. 
                        document.body.appendChild(report); 
                        
                        // Wait for the chart image to be ready. 
                        if (image.decode) { 
                            await image.decode(); 
                        } 
                        
                        await new Promise(resolve => { 
                            requestAnimationFrame(() => { 
                                requestAnimationFrame(resolve); 
                            }); 
                        }); 
                        
                        // Open the browser PDF/print dialog. 
                        window.print(); 
                    
                    } catch (error) { 
                        console.error("PDF export failed:", error); 
                        alert("Could not generate PDF. Check the console."); 
                    } finally { 
                        if (button) { 
                            button.disabled = false; 
                            button.textContent = "Download PDF"; } 
                        } 
                    } 
            
            function initialiseDownload() { 
                const button = document.getElementById("downloadPdfBtn"); 
                
                if (button) { 
                    button.addEventListener("click", downloadReport); 
                } 
            } 
            
            if (document.readyState === "loading") { 
                document.addEventListener( 
                    "DOMContentLoaded", 
                    initialiseDownload, 
                    { once: true } 
                ); } else { 
                    initialiseDownload(); 
                } 
            })();