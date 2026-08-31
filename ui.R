library(shiny)
library(plotly)

ui <- navbarPage(
  
  title = div(
    style = "
      display:flex;
      align-items:center;
      gap:10px;
      color:white;
    ",
    
    div(
      style = "
        width:34px;
        height:34px;
        border-radius:50%;
        background:#35a765;
        color:white;
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight:700;
      ",
      "RY"
    ),
    
    div(
      tags$strong("Resilient Youth Australia"),
      br(),
      tags$span(
        style = "
          font-size:11px;
          font-weight:400;
          color:#d4dfeb;
        ",
        "Wellbeing Platform"
      )
    )
  ),
  
  id = "mainNav",
  inverse = TRUE,
  selected = "Explore Data",
  
  header = tags$head(
    
    tags$style(
      HTML("

        body {
          background-color: #f5f7fa;
          font-family: 'Segoe UI', Arial, sans-serif;
          color: #1f2937;
        }

        /* ===============================
           NAVIGATION
        =============================== */

        .navbar {
          background-color: #0d2340 !important;
          border: none !important;
          min-height: 62px;
          border-radius: 0 0 14px 14px;
          margin-bottom: 24px;
        }

        .navbar-brand {
          padding-top: 10px !important;
          padding-bottom: 10px !important;
          height: auto !important;
        }

        .navbar-nav > li > a {
          color: #d9e3ef !important;
          font-size: 14px;
          font-weight: 500;
          padding-top: 21px !important;
          padding-bottom: 21px !important;
        }

        .navbar-nav > li > a:hover {
          color: white !important;
          background-color: rgba(255,255,255,0.06) !important;
        }

        .navbar-nav > .active > a,
        .navbar-nav > .active > a:hover,
        .navbar-nav > .active > a:focus {
          color: white !important;
          background-color: rgba(255,255,255,0.10) !important;
          font-weight: 700;
        }

        /* ===============================
           GENERAL
        =============================== */

        .page-container {
          max-width: 1420px;
          margin: 0 auto;
          padding: 0 18px 30px 18px;
        }

        .page-card {
          background: white;
          border-radius: 14px;
          border: 1px solid #e5ebf1;
          box-shadow: 0 4px 14px rgba(18, 38, 63, 0.05);
        }

        /* ===============================
           HEADER
        =============================== */

        .page-header-card {
          padding: 24px 28px;
          margin-bottom: 20px;
        }

        .page-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 22px;
        }

        .page-title {
          font-size: 30px;
          font-weight: 700;
          color: #14213d;
          margin: 0 0 7px 0;
        }

        .page-desc {
          color: #677386;
          font-size: 14px;
          line-height: 1.55;
          max-width: 780px;
        }

        .source-box {
          background: #f7faff;
          border: 1px solid #dbe8f6;
          border-radius: 10px;
          padding: 13px 15px;
          min-width: 250px;
          font-size: 12px;
          color: #50627a;
        }

        /* ===============================
           FILTER
        =============================== */

        .filter-card {
          padding: 20px;
          position: sticky;
          top: 15px;
        }

        .filter-title {
          font-size: 19px;
          font-weight: 700;
          color: #14213d;
          margin-bottom: 18px;
        }

        .control-label {
          font-weight: 600;
          font-size: 13px;
          color: #27364a;
        }

        .selectize-input,
        .form-control {
          border-radius: 8px !important;
          border: 1px solid #d5dde6 !important;
          box-shadow: none !important;
        }

        .checkbox {
          font-size: 13px;
          margin-top: 8px;
          margin-bottom: 8px;
        }

        hr {
          border-top: 1px solid #edf1f4;
          margin-top: 18px;
          margin-bottom: 18px;
        }

        .update-button {
          width: 100%;
          background: #0d2340 !important;
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 10px 12px !important;
          font-weight: 600 !important;
          margin-top: 10px;
        }

        .update-button:hover {
          background: #16365f !important;
        }

        /* ===============================
           RESULT CARDS
        =============================== */

        .result-card {
          background: white;
          border-radius: 13px;
          border: 1px solid #e5ebf1;
          box-shadow: 0 4px 14px rgba(18,38,63,0.05);
          padding: 18px;
          min-height: 105px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .result-icon {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .icon-green {
          background: #e8f7ee;
          color: #24955a;
        }

        .icon-orange {
          background: #fff2df;
          color: #df8a27;
        }

        .icon-red {
          background: #fdebea;
          color: #c93d34;
        }

        .result-label {
          font-size: 12px;
          color: #7c8796;
        }

        .result-value {
          font-size: 27px;
          font-weight: 700;
          line-height: 1.05;
        }

        .green-text {
          color: #24955a;
        }

        .orange-text {
          color: #df8a27;
        }

        .red-text {
          color: #c93d34;
        }

        .result-sub {
          font-size: 11px;
          color: #9099a6;
          margin-top: 3px;
        }

        /* ===============================
           CHARTS
        =============================== */

        .chart-card {
          padding: 20px;
          min-height: 465px;
          margin-bottom: 16px;
        }

        .chart-title {
          font-size: 16px;
          font-weight: 700;
          color: #14213d;
          margin-bottom: 4px;
        }

        .chart-subtitle {
          font-size: 12px;
          color: #7b8797;
          margin-bottom: 10px;
        }

        .small-action {
          text-align: center;
          margin-top: 6px;
        }

        .small-action .btn {
          border-radius: 8px;
          background: white;
          border: 1px solid #d6dee7;
          color: #405269;
          font-size: 12px;
        }

        /* ===============================
           SUMMARY
        =============================== */

        .insight-box {
          background: #eaf6ff;
          border: 1px solid #cfe7fa;
          border-radius: 11px;
          padding: 15px 18px;
          margin-bottom: 24px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .insight-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #ccecff;
          color: #217ca3;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          flex-shrink: 0;
        }

        .insight-text {
          color: #345267;
          font-size: 13px;
          line-height: 1.55;
        }

        /* ===============================
           OTHER PAGES
        =============================== */

        .simple-page {
          max-width: 1100px;
          margin: 0 auto 30px auto;
          padding: 30px;
        }

        .simple-page h2 {
          color: #14213d;
          font-weight: 700;
        }

        .simple-page p {
          color: #687588;
          line-height: 1.6;
        }

        /* ===============================
           MOBILE
        =============================== */

        @media (max-width: 900px) {

          .page-header-row {
            flex-direction: column;
          }

          .source-box {
            width: 100%;
            min-width: auto;
          }

          .filter-card {
            position: static;
          }
        }

      ")
    )
  ),
  
  # =====================================================
  # HOME
  # =====================================================
  
  tabPanel(
    
    "Home",
    
    div(
      class = "page-container",
      
      div(
        class = "page-card simple-page",
        
        h2("Welcome to the RYA Wellbeing Data Platform"),
        
        p(
          "This platform is designed to help users explore student wellbeing data in a clear and interactive way."
        ),
        
        p(
          "Use the Explore Data page to compare wellbeing results across gender, grade, socioeconomic status and year."
        )
      )
    )
  ),
  
  # =====================================================
  # EXPLORE DATA
  # =====================================================
  
  tabPanel(
    
    "Explore Data",
    
    div(
      class = "page-container",
      
      # ---------------------------------------------------
      # PAGE HEADER
      # ---------------------------------------------------
      
      div(
        class = "page-card page-header-card",
        
        div(
          class = "page-header-row",
          
          div(
            
            h1(
              class = "page-title",
              "Life Satisfaction"
            ),
            
            div(
              class = "page-desc",
              
              "Students rated their current life using a wellbeing ladder. ",
              "Results show how students are feeling and functioning in their everyday lives."
            )
          ),
          
          div(
            class = "source-box",
            
            strong(
              "Data from the Resilient Youth Australia Survey"
            ),
            
            br(),
            
            "Grade 3–12 students across Australia",
            
            br(),
            br(),
            
            actionLink(
              "goMethodology",
              "View methodology"
            )
          )
        )
      ),
      
      # ---------------------------------------------------
      # MAIN ROW
      # ---------------------------------------------------
      
      fluidRow(
        
        # =================================================
        # FILTER
        # =================================================
        
        column(
          
          width = 3,
          
          div(
            class = "page-card filter-card",
            
            div(
              class = "filter-title",
              "Refine results"
            ),
            
            selectInput(
              "displayBy",
              "Display by",
              choices = c(
                "Gender",
                "Grade",
                "SES"
              ),
              selected = "Gender"
            ),
            
            checkboxInput(
              "combined",
              "All groups combined",
              FALSE
            ),
            
            hr(),
            
            uiOutput(
              "groupFilters"
            ),
            
            hr(),
            
            selectInput(
              "year",
              "Year",
              choices = c(
                "2023",
                "2024"
              ),
              selected = "2024"
            ),
            
            actionButton(
              "updateResults",
              "Update results",
              class = "update-button"
            )
          )
        ),
        
        # =================================================
        # CONTENT
        # =================================================
        
        column(
          
          width = 9,
          
          # -----------------------------------------------
          # RESULT CARDS
          # -----------------------------------------------
          
          fluidRow(
            
            column(
              width = 4,
              
              div(
                class = "result-card",
                
                div(
                  class = "result-icon icon-green",
                  "↑"
                ),
                
                div(
                  
                  div(
                    class = "result-label",
                    "Thriving"
                  ),
                  
                  div(
                    class = "result-value green-text",
                    textOutput("thrivingValue")
                  ),
                  
                  div(
                    class = "result-sub",
                    "of students"
                  )
                )
              )
            ),
            
            column(
              width = 4,
              
              div(
                class = "result-card",
                
                div(
                  class = "result-icon icon-orange",
                  "~"
                ),
                
                div(
                  
                  div(
                    class = "result-label",
                    "Doing OK"
                  ),
                  
                  div(
                    class = "result-value orange-text",
                    textOutput("doingOKValue")
                  ),
                  
                  div(
                    class = "result-sub",
                    "of students"
                  )
                )
              )
            ),
            
            column(
              width = 4,
              
              div(
                class = "result-card",
                
                div(
                  class = "result-icon icon-red",
                  "!"
                ),
                
                div(
                  
                  div(
                    class = "result-label",
                    "Struggling"
                  ),
                  
                  div(
                    class = "result-value red-text",
                    textOutput("strugglingValue")
                  ),
                  
                  div(
                    class = "result-sub",
                    "of students"
                  )
                )
              )
            )
          ),
          
          # -----------------------------------------------
          # CHARTS
          # -----------------------------------------------
          
          fluidRow(
            
            column(
              width = 6,
              
              div(
                class = "page-card chart-card",
                
                div(
                  class = "chart-title",
                  "How are students feeling?"
                ),
                
                div(
                  class = "chart-subtitle",
                  "Percentage of students in each wellbeing group"
                ),
                
                plotlyOutput(
                  "stackedPlot",
                  height = "360px"
                ),
                
                div(
                  class = "small-action",
                  
                  actionButton(
                    "viewTable",
                    "View data table"
                  )
                )
              )
            ),
            
            column(
              width = 6,
              
              div(
                class = "page-card chart-card",
                
                div(
                  class = "chart-title",
                  "Average life satisfaction"
                ),
                
                div(
                  class = "chart-subtitle",
                  "Mean score with 95% confidence interval"
                ),
                
                plotlyOutput(
                  "meanPlot",
                  height = "360px"
                ),
                
                div(
                  class = "small-action",
                  
                  actionButton(
                    "aboutCI",
                    "About confidence intervals"
                  )
                )
              )
            )
          ),
          
          # -----------------------------------------------
          # SUMMARY
          # -----------------------------------------------
          
          div(
            class = "insight-box",
            
            div(
              class = "insight-icon",
              "↗"
            ),
            
            div(
              class = "insight-text",
              textOutput("summaryText")
            )
          )
        )
      )
    )
  ),
  
  # =====================================================
  # METHODOLOGY
  # =====================================================
  
  tabPanel(
    
    "Methodology",
    
    div(
      class = "page-container",
      
      div(
        class = "page-card simple-page",
        
        h2("Methodology"),
        
        p(
          "This page will explain how wellbeing measures are calculated, categorised and presented."
        ),
        
        h4("Life Satisfaction"),
        
        p(
          "The final scoring description should follow the confirmed RYA methodology and scoring documentation."
        ),
        
        h4("Confidence Intervals"),
        
        p(
          "Mean scores may be presented with 95% confidence intervals to show uncertainty around the estimated mean."
        ),
        
        h4("Privacy"),
        
        p(
          "Small groups may be suppressed to protect student privacy."
        )
      )
    )
  ),
  
  # =====================================================
  # ABOUT
  # =====================================================
  
  tabPanel(
    
    "About",
    
    div(
      class = "page-container",
      
      div(
        class = "page-card simple-page",
        
        h2("About"),
        
        p(
          "The RYA Wellbeing Data Platform is designed to make student wellbeing information easier to explore and understand."
        ),
        
        p(
          "The platform provides interactive views of aggregated wellbeing data for public use."
        )
      )
    )
  )
)